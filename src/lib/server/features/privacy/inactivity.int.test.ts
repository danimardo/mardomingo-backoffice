// Cuentas inactivas contra SQLite real y reloj falso (BE-FR-86 CA1–CA3, US10 escenario 5; T296): aviso una sola vez, borrado
// al terminar el plazo con `forfeit` de lo que quede, cancelación por cualquier actividad y exención de las cuentas con compra
// real, del administrador, de las bloqueadas y de las sin verificar.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { privacyFixture, type PrivacyFixture } from '../../../../../tests/builders/privacy';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { DAY_MS } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { user } from '../accounts/schema';
import { creditBuckets, creditMovements } from '../credits/schema';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);
const FOUR_YEARS_AGO = NOW - 4 * 365 * DAY_MS;

let f: PrivacyFixture;

beforeEach(async () => {
	f = await privacyFixture();
	f.panel.fixture.base.clock.set(NOW);
});

afterEach(() => {
	f.close();
});

const base = () => f.panel.fixture.base;
const db = () => base().db;

/** Cuenta verificada con la última actividad indicada. */
function addAccount(id: string, over: Partial<typeof user.$inferInsert> = {}): string {
	db()
		.insert(user)
		.values({
			id,
			name: '',
			email: `${id}@ejemplo.es`,
			emailVerified: true,
			createdAt: new Date(FOUR_YEARS_AGO - 30 * DAY_MS),
			lastActivityAt: toEpochMs(FOUR_YEARS_AGO),
			...over
		})
		.run();
	return id;
}

function rowOf(id: string) {
	return db().select().from(user).where(eq(user.id, id)).get();
}

function events(name: Parameters<typeof eventsNamed>[1]) {
	return eventsNamed(base().logger, name);
}

describe('aviso (BE-FR-86)', () => {
	it('avisa una sola vez a la cuenta verificada sin compra real y sin actividad en tres años', async () => {
		const id = addAccount('usr_inactiva');

		const first = await f.privacy.processInactive();
		const again = await f.privacy.processInactive();

		expect(first).toEqual({ notified: 1, cancelled: 0, deleted: 0 });
		expect(again).toEqual({ notified: 0, cancelled: 0, deleted: 0 });
		expect(rowOf(id)?.inactivityWarnedAt).toBe(NOW);
		const sent = f.mail.sent.filter((email) => email.to === 'usr_inactiva@ejemplo.es');
		expect(sent).toHaveLength(1);
		expect(sent[0]?.subject).toBe('Tu cuenta Mardomingo se borrará si no vuelves a entrar');
		expect(sent[0]?.text).toContain('30 días');
		expect(sent[0]?.text).toContain('https://cuenta.mardomingo.test/login');
		expect(events('privacy.inactive.notified').map((event) => event.fields)).toEqual([
			{ count: 1 }
		]);
	});

	it('una cuenta con actividad reciente, o sin actividad pero dada de alta hace poco, no se avisa', async () => {
		addAccount('usr_activa', { lastActivityAt: toEpochMs(NOW - 100 * DAY_MS) });
		addAccount('usr_nueva', {
			lastActivityAt: null,
			createdAt: new Date(NOW - 100 * DAY_MS)
		});

		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 0 });
	});

	it('una cuenta que nunca tuvo actividad cuenta desde su alta', async () => {
		const id = addAccount('usr_sin_actividad', {
			lastActivityAt: null,
			createdAt: new Date(FOUR_YEARS_AGO)
		});

		expect(await f.privacy.processInactive()).toMatchObject({ notified: 1 });
		expect(rowOf(id)?.inactivityWarnedAt).toBe(NOW);
	});

	it('si el aviso no sale, no se anota y se reintenta en la siguiente ejecución', async () => {
		const id = addAccount('usr_reintento');
		f.mail.fail('rate_limit_exceeded');

		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 0 });
		expect(rowOf(id)?.inactivityWarnedAt).toBeNull();

		f.mail.fail(undefined);
		expect(await f.privacy.processInactive()).toMatchObject({ notified: 1 });
		expect(rowOf(id)?.inactivityWarnedAt).toBe(NOW);
	});
});

describe('borrado y cancelación (BE-FR-86 CA2, CA3)', () => {
	it('sin actividad durante el aviso, borra la cuenta y pierde los créditos gratuitos con forfeit', async () => {
		const id = addAccount('usr_borrar');
		base().credits.grantWelcome({ userId: id, emailNormalizedHash: 'hash-borrar' });
		await f.privacy.processInactive();

		base().clock.set(NOW + 29 * DAY_MS);
		expect(await f.privacy.processInactive()).toMatchObject({ deleted: 0 });
		expect(rowOf(id)?.deletedAt).toBeNull();

		base().clock.set(NOW + 30 * DAY_MS);
		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 1 });

		expect(rowOf(id)).toMatchObject({ email: `deleted+${id}@invalid` });
		expect(rowOf(id)?.deletedAt).not.toBeNull();
		const buckets = db().select().from(creditBuckets).where(eq(creditBuckets.userId, id)).all();
		expect(buckets.every((bucket) => bucket.remainingMicro === 0)).toBe(true);
		const forfeits = db()
			.select()
			.from(creditMovements)
			.where(eq(creditMovements.userId, id))
			.all()
			.filter((movement) => movement.type === 'forfeit');
		expect(forfeits.length).toBeGreaterThan(0);
		expect(events('credits.balance.forfeited').map((event) => event.fields)).toContainEqual({
			reason: 'inactivity',
			count: forfeits.length
		});
		expect(events('privacy.account.deleted').map((event) => event.fields)).toContainEqual({
			reason: 'inactivity'
		});
	});

	it('cualquier actividad durante el plazo de aviso cancela el borrado', async () => {
		const id = addAccount('usr_vuelve');
		await f.privacy.processInactive();

		// Entra a la cuenta diez días después del aviso.
		db()
			.update(user)
			.set({ lastActivityAt: toEpochMs(NOW + 10 * DAY_MS) })
			.where(eq(user.id, id))
			.run();
		base().clock.set(NOW + 31 * DAY_MS);

		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 1, deleted: 0 });
		expect(rowOf(id)?.inactivityWarnedAt).toBeNull();
		expect(rowOf(id)?.deletedAt).toBeNull();
		expect(events('privacy.inactive.cancelled')).toHaveLength(1);
	});
});

describe('exenciones (BE-FR-86 CA1)', () => {
	it('una cuenta con compra real nunca se avisa ni se borra, tenga o no saldo', async () => {
		const id = addAccount('usr_compradora');
		base().credits.grantWelcome({ userId: id, emailNormalizedHash: 'hash-compradora' });
		markRealPurchase(db(), id);

		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 0 });
		base().clock.set(NOW + 400 * DAY_MS);
		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 0 });

		expect(rowOf(id)?.deletedAt).toBeNull();
		expect(rowOf(id)?.inactivityWarnedAt).toBeNull();
	});

	it('si compra durante el aviso, el aviso pendiente se retira y no se borra', async () => {
		const id = addAccount('usr_compra_tarde');
		base().credits.grantWelcome({ userId: id, emailNormalizedHash: 'hash-tarde' });
		await f.privacy.processInactive();
		expect(rowOf(id)?.inactivityWarnedAt).toBe(NOW);

		markRealPurchase(db(), id);
		base().clock.set(NOW + 60 * DAY_MS);
		await f.privacy.processInactive();

		expect(rowOf(id)?.deletedAt).toBeNull();
		expect(rowOf(id)?.inactivityWarnedAt).toBeNull();
	});

	it('el administrador, las cuentas bloqueadas y las sin verificar no se seleccionan', async () => {
		// Solo puede haber un administrador (one_admin): si el montaje ya trae uno, se envejece en lugar de añadir otro.
		const admin = db().select().from(user).where(eq(user.role, 'admin')).get();
		if (admin === undefined) addAccount('usr_admin_antigua', { role: 'admin' });
		else {
			db()
				.update(user)
				.set({
					emailVerified: true,
					createdAt: new Date(FOUR_YEARS_AGO - 30 * DAY_MS),
					lastActivityAt: toEpochMs(FOUR_YEARS_AGO)
				})
				.where(eq(user.id, admin.id))
				.run();
		}
		addAccount('usr_bloqueada', { banned: true });
		addAccount('usr_sin_verificar', { emailVerified: false });

		expect(await f.privacy.processInactive()).toEqual({ notified: 0, cancelled: 0, deleted: 0 });
		expect(f.mail.sent.filter((email) => email.subject.includes('se borrará'))).toHaveLength(0);
		expect(db().select().from(user).where(eq(user.role, 'admin')).get()?.deletedAt).toBeNull();
	});
});
