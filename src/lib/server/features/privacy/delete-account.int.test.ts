// Borrado de cuenta contra SQLite real (BE-FR-07 CA1–CA4, D-15, D-18; T282): sesiones revocadas, saldo anulado con `forfeit`,
// reservas liberadas, cuenta anonimizada, datos propios borrados, tablas contables intactas y con sus _triggers_, email libre
// sin nueva bienvenida, todo o nada y el ledger cuadrado. Hay dos cuentas con los mismos datos propios: la del saldo (bolsas
// con crédito, compra, reserva abierta y perfil fiscal), que es la que se borra casi siempre, y la de la deuda (la del panel:
// deuda y saldo positivo no coexisten), que prueba que borrar la cuenta no perdona lo que se debe.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registration, verificationTokenFor } from '../../../../../tests/builders/accounts';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	PRIVACY_PASSWORD,
	privacyFixture,
	welcomeHashOf,
	type PrivacyFixture
} from '../../../../../tests/builders/privacy';
import { toEpochMs } from '$lib/shared/time';
import { account, session, user, userAppActivity, verification } from '../accounts/schema';
import {
	creditBuckets,
	creditHolds,
	creditMovements,
	userBalances,
	welcomeGrants
} from '../credits/schema';
import { billingProfiles } from '../invoicing/schema';
import { syncDocuments } from '../sync';
import { deleteAccount } from './service';

let f: PrivacyFixture;
/** Cuenta con saldo: la que se borra. */
let saver: string;
/** Cuenta con deuda y sin saldo: la que no debe verse afectada, salvo en la prueba de la deuda. */
let debtor: string;

beforeEach(async () => {
	f = await privacyFixture();
	saver = f.otherUserId;
	debtor = f.userId;
});

afterEach(() => {
	f.close();
});

function db() {
	return f.panel.fixture.base.db;
}

function sqlite() {
	return f.panel.fixture.base.database.sqlite;
}

function events(name: Parameters<typeof eventsNamed>[1]) {
	return eventsNamed(f.panel.fixture.base.logger, name);
}

/** Contenido de una tabla, ordenado, para compararla antes y después sin enumerar sus columnas. */
function snapshot(table: string, where = '1 = 1'): string {
	return JSON.stringify(
		sqlite().prepare(`SELECT * FROM "${table}" WHERE ${where} ORDER BY rowid`).all()
	);
}

function snapshotOf(userId: string): Record<string, string> {
	const own = `user_id = '${userId}'`;
	return {
		sessions: snapshot('session', own),
		accounts: snapshot('account', own),
		documents: snapshot('sync_documents', own),
		activity: snapshot('user_app_activity', own),
		profile: snapshot('billing_profiles', own),
		buckets: snapshot('credit_buckets', own),
		holds: snapshot('credit_holds', own),
		user: snapshot('user', `id = '${userId}'`)
	};
}

const KEPT_INTACT = [
	'welcome_grants',
	'terms_acceptances',
	'ai_operations',
	'payments',
	'admin_audit',
	'invoices'
] as const;

function triggers(): string[] {
	return sqlite()
		.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
		.pluck()
		.all()
		.map(String);
}

function deleteAsUser(userId: string, password = PRIVACY_PASSWORD) {
	return f.privacy.deleteAccount({ userId, reason: 'user', password });
}

describe('borrado de cuenta (BE-FR-07)', () => {
	it('con la contraseña correcta anula el saldo con forfeit, libera las reservas y deja la cuenta anonimizada', async () => {
		const before = f.deps.credits.getBalance(saver);
		expect(before.freeMicro).toBeGreaterThan(0);
		expect(before.paidMicro).toBeGreaterThan(0);
		expect(before.reservedMicro).toBeGreaterThan(0);
		f.deps.credits.setLowBalanceThreshold({ userId: saver, thresholdMicro: 5_000_000 });
		const withBalance = db()
			.select()
			.from(creditBuckets)
			.where(eq(creditBuckets.userId, saver))
			.all()
			.filter((bucket) => bucket.remainingMicro > 0);
		const created = db().select().from(user).where(eq(user.id, saver)).get()?.createdAt;

		const outcome = await deleteAsUser(saver);

		expect(outcome).toEqual({
			status: 'deleted',
			forfeitedMicro: before.freeMicro + before.paidMicro
		});
		const buckets = db().select().from(creditBuckets).where(eq(creditBuckets.userId, saver)).all();
		expect(buckets.every((bucket) => bucket.remainingMicro === 0)).toBe(true);
		const forfeits = db()
			.select()
			.from(creditMovements)
			.where(eq(creditMovements.userId, saver))
			.all()
			.filter((movement) => movement.type === 'forfeit');
		expect(forfeits.length).toBeGreaterThan(1);
		expect(forfeits.map((movement) => movement.bucketId).sort()).toEqual(
			withBalance.map((bucket) => bucket.id).sort()
		);
		expect(forfeits.every((movement) => movement.amountMicro < 0)).toBe(true);
		expect(events('credits.balance.forfeited').map((event) => event.fields)).toEqual([
			{ reason: 'user', count: withBalance.length }
		]);
		const holds = db().select().from(creditHolds).where(eq(creditHolds.userId, saver)).all();
		expect(holds.length).toBeGreaterThan(0);
		expect(
			holds.every((hold) => hold.releasedAt !== null && hold.releaseReason === 'released')
		).toBe(true);

		const row = db().select().from(user).where(eq(user.id, saver)).get();
		expect(row).toMatchObject({
			id: saver,
			email: `deleted+${saver}@invalid`,
			name: '',
			image: null,
			role: 'user',
			emailNormalized: null,
			lastActivityAt: null,
			inactivityWarnedAt: null,
			banReason: null
		});
		expect(row?.deletedAt).not.toBeNull();
		expect(row?.createdAt).toEqual(created);
		expect(
			db().select().from(userBalances).where(eq(userBalances.userId, saver)).get()
				?.lowBalanceThresholdMicro
		).toBeNull();
		expect(events('privacy.account.deleted').map((event) => event.fields)).toEqual([
			{ reason: 'user' }
		]);
	});

	it('revoca todas las sesiones y borra lo que cuelga solo de la cuenta, sin tocar a la otra', async () => {
		const otherBefore = snapshotOf(debtor);
		expect(db().select().from(session).where(eq(session.userId, saver)).all()).toHaveLength(2);
		expect(
			db().select().from(syncDocuments).where(eq(syncDocuments.userId, saver)).all()
		).toHaveLength(2);
		expect(
			db().select().from(billingProfiles).where(eq(billingProfiles.userId, saver)).all()
		).toHaveLength(1);

		await deleteAsUser(saver);

		expect(db().select().from(session).where(eq(session.userId, saver)).all()).toEqual([]);
		expect(db().select().from(account).where(eq(account.userId, saver)).all()).toEqual([]);
		expect(
			db().select().from(userAppActivity).where(eq(userAppActivity.userId, saver)).all()
		).toEqual([]);
		expect(db().select().from(syncDocuments).where(eq(syncDocuments.userId, saver)).all()).toEqual(
			[]
		);
		expect(
			db().select().from(billingProfiles).where(eq(billingProfiles.userId, saver)).all()
		).toEqual([]);
		// Los tokens de recuperación y de cambio de email de la cuenta desaparecen; los de la otra se quedan.
		const tokens = db()
			.select()
			.from(verification)
			.all()
			.map((item) => item.id)
			.sort();
		expect(tokens).toEqual([`ver_email_${debtor}`, `ver_reset_${debtor}`]);
		expect(snapshotOf(debtor)).toEqual(otherBefore);
		expect(events('accounts.session.revoked').map((event) => event.fields)).toEqual([
			{ reason: 'account_deleted', count: 2 }
		]);
	});

	it('conserva íntegras las tablas contables y de consentimiento y no toca sus triggers (D-18)', async () => {
		const before = Object.fromEntries(KEPT_INTACT.map((table) => [table, snapshot(table)]));
		const movementsBefore = snapshot('credit_movements');
		const triggersBefore = triggers();
		expect(triggersBefore.length).toBeGreaterThan(0);

		await deleteAsUser(saver);

		for (const table of KEPT_INTACT) expect(snapshot(table), table).toEqual(before[table]);
		// Los movimientos anteriores siguen idénticos; solo se añaden los `forfeit`.
		expect(snapshot('credit_movements', "type <> 'forfeit'")).toEqual(movementsBefore);
		expect(snapshot('credit_movements', "type = 'forfeit'")).not.toEqual('[]');
		expect(triggers()).toEqual(triggersBefore);
	});

	it('el email queda libre, pero la bienvenida no se vuelve a conceder (CA3)', async () => {
		const address = `${saver}@ejemplo.es`;
		const hash = welcomeHashOf(address);
		db()
			.insert(welcomeGrants)
			.values({ emailNormalizedHash: hash, grantedAt: toEpochMs(1) })
			.run();

		await deleteAsUser(saver);
		expect(db().select().from(user).where(eq(user.email, address)).all()).toEqual([]);

		await f.accounts.register(registration({ email: address, remoteIp: '198.51.100.20' }));
		const verified = await f.accounts.verifyEmail(verificationTokenFor(f.mail, address));

		expect(f.deps.credits.getBalance(verified.userId).totalMicro).toBe(0);
		expect(
			db().select().from(welcomeGrants).where(eq(welcomeGrants.emailNormalizedHash, hash)).all()
		).toHaveLength(1);
	});

	it('el ledger sigue cuadrando tras el forfeit: el saldo reconstruido es el de las bolsas menos la deuda (SC-003)', async () => {
		await deleteAsUser(saver);

		const movements = db()
			.select()
			.from(creditMovements)
			.where(eq(creditMovements.userId, saver))
			.all();
		const reconstructed = movements.reduce((sum, movement) => sum + movement.amountMicro, 0);
		const balance = f.deps.credits.getBalance(saver);
		expect(reconstructed).toBe(balance.totalMicro);
		expect(balance.totalMicro).toBe(0);
	});

	it('la deuda no se perdona: la cuenta borrada sigue debiéndola y el ledger cuadra', async () => {
		const movementsBefore = snapshot('credit_movements', `user_id = '${debtor}'`);
		expect(f.deps.credits.getBalance(debtor).debtMicro).toBe(50_000_000);

		const outcome = await deleteAsUser(debtor);

		expect(outcome).toEqual({ status: 'deleted', forfeitedMicro: 0 });
		const balance = f.deps.credits.getBalance(debtor);
		expect(balance.debtMicro).toBe(50_000_000);
		expect(balance.totalMicro).toBe(-50_000_000);
		const movements = db()
			.select()
			.from(creditMovements)
			.where(eq(creditMovements.userId, debtor))
			.all();
		expect(movements.reduce((sum, movement) => sum + movement.amountMicro, 0)).toBe(
			balance.totalMicro
		);
		expect(snapshot('credit_movements', `user_id = '${debtor}'`)).toEqual(movementsBefore);
		expect(events('credits.balance.forfeited')).toEqual([]);
	});

	it('con una contraseña errónea no cambia nada y lo registra', async () => {
		const tables = [
			'user',
			'session',
			'account',
			'credit_buckets',
			'credit_movements',
			'credit_holds',
			'sync_documents',
			'billing_profiles'
		];
		const before = tables.map((table) => snapshot(table));

		const outcome = await deleteAsUser(saver, 'otra-contraseña-distinta');

		expect(outcome).toEqual({ status: 'wrong_password' });
		expect(tables.map((table) => snapshot(table))).toEqual(before);
		expect(events('privacy.account.deletion_rejected').map((event) => event.fields)).toEqual([
			{ reason: 'wrong_password' }
		]);
		expect(events('privacy.account.deleted')).toEqual([]);
	});

	it('si una de las dueñas falla, no queda nada a medias', async () => {
		const tables = [
			'user',
			'session',
			'account',
			'credit_buckets',
			'credit_movements',
			'credit_holds',
			'sync_documents',
			'billing_profiles'
		];
		const before = tables.map((table) => snapshot(table));
		const failing = {
			...f.deps,
			accounts: {
				...f.deps.accounts,
				anonymizeUser: (): boolean => {
					throw new Error('fallo de prueba al anonimizar');
				}
			}
		};

		await expect(
			deleteAccount(failing, { userId: saver, reason: 'user', password: PRIVACY_PASSWORD })
		).rejects.toThrow('fallo de prueba al anonimizar');

		expect(tables.map((table) => snapshot(table))).toEqual(before);
		expect(events('privacy.account.deleted')).toEqual([]);
	});

	it('borrar dos veces responde not_found la segunda y no vuelve a anular nada', async () => {
		await f.privacy.deleteAccount({ userId: saver, reason: 'inactivity' });
		const movements = snapshot('credit_movements');

		const second = await f.privacy.deleteAccount({ userId: saver, reason: 'inactivity' });

		expect(second).toEqual({ status: 'not_found' });
		expect(snapshot('credit_movements')).toEqual(movements);
	});

	it('por inactividad no pide contraseña y lo registra con ese motivo', async () => {
		const outcome = await f.privacy.deleteAccount({ userId: saver, reason: 'inactivity' });

		expect(outcome.status).toBe('deleted');
		expect(events('privacy.account.deleted').map((event) => event.fields)).toEqual([
			{ reason: 'inactivity' }
		]);
	});
});
