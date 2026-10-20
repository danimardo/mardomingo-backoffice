// Retención de datos contra SQLite real y reloj falso (BE-FR-83, data-model §6, D-18; T293) y aceptación SC-016 (T297): una línea
// de registro por categoría, cada plazo en su sitio, ninguna tabla inmutable modificada y, tras ejecutar las tres tareas diarias de
// privacidad, ninguna cuenta con compra real borrada y ningún dato personal fuera de plazo (salvo las IP, H-17).
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { privacyFixture, type PrivacyFixture } from '../../../../../tests/builders/privacy';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { DAY_MS, madridMidnight } from '$lib/shared/dates';
import { toMicro } from '$lib/shared/money';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import { authRateLimits, loginAttempts, session, user, verification } from '../accounts/schema';
import { aiOperations } from '../ai/schema';
import { creditHolds, creditMovements } from '../credits/schema';
import { termsAcceptances } from '../legal/schema';
import { alertsState } from '../notifications/schema';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);
const MONTHS_24_AGO = madridMidnight(toCivilDate('2024-10-19'));

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

function addSession(id: string, userId: string, expiresAt: number): void {
	db()
		.insert(session)
		.values({
			id,
			userId,
			token: `tok_${id}`,
			ipAddress: '203.0.113.50',
			userAgent: 'Equipo de prueba',
			expiresAt: new Date(expiresAt),
			createdAt: new Date(NOW - 40 * DAY_MS),
			updatedAt: new Date(NOW - 40 * DAY_MS)
		})
		.run();
}

function addOperation(createdAt: number): string {
	const id = insertInFlightOperation(db(), { userId: f.userId });
	db()
		.update(aiOperations)
		.set({
			status: 'ok',
			createdAt: toEpochMs(createdAt),
			completedAt: toEpochMs(createdAt + 1_000),
			sessionId: null,
			idempotencyKey: `clave-${id}`,
			providerGenerationId: `gen-${id}`
		})
		.where(eq(aiOperations.id, id))
		.run();
	return id;
}

function retentionEvents() {
	return eventsNamed(base().logger, 'privacy.retention.applied').map((event) => event.fields);
}

describe('applyRetention: cada plazo', () => {
	it('sesiones: se borran las caducadas hace más de 30 días y se conservan el resto', () => {
		addSession('ses_vieja', f.userId, NOW - 31 * DAY_MS);
		addSession('ses_reciente', f.userId, NOW - 29 * DAY_MS);
		addSession('ses_vigente', f.userId, NOW + DAY_MS);
		const before = db().select().from(session).all().length;

		const report = f.privacy.applyRetention();

		expect(report.sessions).toBe(1);
		const left = db().select().from(session).all();
		expect(left.length).toBe(before - 1);
		expect(left.map((row) => row.id)).not.toContain('ses_vieja');
		expect(left.map((row) => row.id)).toEqual(
			expect.arrayContaining(['ses_reciente', 'ses_vigente'])
		);
	});

	it('operaciones de IA: a los 24 meses se desligan de la persona y se conservan los datos agregados', () => {
		const old = addOperation(MONTHS_24_AGO - 1);
		const recent = addOperation(MONTHS_24_AGO);
		const before = db().select().from(aiOperations).where(eq(aiOperations.id, old)).get();

		const report = f.privacy.applyRetention();

		expect(report.aiOperations).toBe(1);
		const after = db().select().from(aiOperations).where(eq(aiOperations.id, old)).get();
		expect(after).toMatchObject({
			userId: null,
			sessionId: null,
			idempotencyKey: null,
			providerGenerationId: null
		});
		// Lo demás, que sirve a las estadísticas, queda igual.
		expect(after).toMatchObject({
			id: old,
			appId: before?.appId,
			appOperationId: before?.appOperationId,
			status: 'ok',
			costMicroUsd: before?.costMicroUsd,
			createdAt: before?.createdAt
		});
		const kept = db().select().from(aiOperations).where(eq(aiOperations.id, recent)).get();
		expect(kept?.userId).toBe(f.userId);
		expect(kept?.idempotencyKey).toBe(`clave-${recent}`);
	});

	it('el corte de 24 meses es la medianoche de Madrid: no cambia con la hora del día', () => {
		const justBefore = addOperation(MONTHS_24_AGO - 1);
		const justAfter = addOperation(MONTHS_24_AGO + 1);
		base().clock.set(NOW + 12 * 3_600_000);

		f.privacy.applyRetention();

		const userOf = (id: string) =>
			db().select().from(aiOperations).where(eq(aiOperations.id, id)).get()?.userId;
		expect(userOf(justBefore)).toBeNull();
		expect(userOf(justAfter)).toBe(f.userId);
	});

	it('contadores: los de más de 24 h se borran, salvo un bloqueo todavía vigente', () => {
		db()
			.insert(authRateLimits)
			.values([
				{
					scope: 'login',
					ip: '198.51.100.1',
					count: 3,
					windowStart: toEpochMs(NOW - 25 * 3_600_000)
				},
				{ scope: 'login', ip: '198.51.100.2', count: 1, windowStart: toEpochMs(NOW - 3_600_000) }
			])
			.run();
		db()
			.insert(loginAttempts)
			.values([
				{
					emailNormalizedHash: 'h-vieja',
					failures: 2,
					windowStart: toEpochMs(NOW - 30 * 3_600_000),
					lockedUntil: null
				},
				{
					emailNormalizedHash: 'h-bloqueada',
					failures: 10,
					windowStart: toEpochMs(NOW - 30 * 3_600_000),
					lockedUntil: toEpochMs(NOW + 600_000)
				},
				{
					emailNormalizedHash: 'h-caducada',
					failures: 10,
					windowStart: toEpochMs(NOW - 30 * 3_600_000),
					lockedUntil: toEpochMs(NOW - 600_000)
				},
				{
					emailNormalizedHash: 'h-reciente',
					failures: 1,
					windowStart: toEpochMs(NOW - 3_600_000),
					lockedUntil: null
				}
			])
			.run();

		f.privacy.applyRetention();

		expect(
			db()
				.select()
				.from(authRateLimits)
				.all()
				.map((row) => row.ip)
		).toEqual(['198.51.100.2']);
		expect(
			db()
				.select()
				.from(loginAttempts)
				.all()
				.map((row) => row.emailNormalizedHash)
				.sort()
		).toEqual(['h-bloqueada', 'h-reciente']);
	});

	it('tokens de verificación caducados se borran y los vigentes se conservan', () => {
		db()
			.insert(verification)
			.values([
				{
					id: 'ver_caducado',
					identifier: 'reset-password:a',
					value: 'x',
					expiresAt: new Date(NOW - 1000)
				},
				{
					id: 'ver_vigente',
					identifier: 'reset-password:b',
					value: 'y',
					expiresAt: new Date(NOW + 1000)
				}
			])
			.run();

		f.privacy.applyRetention();

		const ids = db()
			.select()
			.from(verification)
			.all()
			.map((row) => row.id);
		expect(ids).not.toContain('ver_caducado');
		expect(ids).toContain('ver_vigente');
	});

	it('reservas liberadas de más de 24 meses se borran; las recientes y las abiertas, no', () => {
		const old = db().select().from(creditHolds).all();
		const holdsBefore = old.length;
		const opOld = insertInFlightOperation(db(), { userId: f.userId });
		const opRecent = insertInFlightOperation(db(), { userId: f.userId });
		const opOpen = insertInFlightOperation(db(), { userId: f.userId });
		const hold = (id: string, op: string, releasedAt: number | null) =>
			db()
				.insert(creditHolds)
				.values({
					id,
					userId: f.userId,
					appId: SEEDED_APP_ID,
					operationId: op,
					amountMicro: toMicro(1_000_000),
					createdAt: toEpochMs(MONTHS_24_AGO - 2 * DAY_MS),
					expiresAt: toEpochMs(MONTHS_24_AGO - DAY_MS),
					releasedAt: releasedAt === null ? null : toEpochMs(releasedAt),
					releaseReason: releasedAt === null ? null : 'released'
				})
				.run();
		hold('hld_vieja', opOld, MONTHS_24_AGO - 1);
		hold('hld_reciente', opRecent, MONTHS_24_AGO + 1);
		hold('hld_abierta', opOpen, null);

		f.privacy.applyRetention();

		const ids = db()
			.select()
			.from(creditHolds)
			.all()
			.map((row) => row.id);
		expect(ids).not.toContain('hld_vieja');
		expect(ids).toEqual(expect.arrayContaining(['hld_reciente', 'hld_abierta']));
		expect(ids.length).toBe(holdsBefore + 2);
	});

	it('claves de alerta con usuario o fecha de más de 30 días se borran; las fijas no', () => {
		const old = toEpochMs(NOW - 31 * DAY_MS);
		const recent = toEpochMs(NOW - DAY_MS);
		db()
			.insert(alertsState)
			.values([
				{ key: 'flagged:usr_a:2026-08-01', active: true, updatedAt: old },
				{ key: 'global_brake:2026-08-01', active: true, updatedAt: old },
				{ key: 'flagged:usr_b:2026-10-18', active: true, updatedAt: recent },
				{ key: 'fx_stale', active: true, updatedAt: old }
			])
			.run();

		f.privacy.applyRetention();

		expect(
			db()
				.select()
				.from(alertsState)
				.all()
				.map((row) => row.key)
				.sort()
		).toEqual(['flagged:usr_b:2026-10-18', 'fx_stale']);
	});
});

describe('applyRetention: garantías', () => {
	it('una línea privacy.retention.applied por categoría, con su recuento', () => {
		// El montaje trae sesiones y fichas con fechas anteriores al reloj del test: una primera pasada las deja en su plazo.
		f.privacy.applyRetention();
		addSession('ses_vieja', f.userId, NOW - 31 * DAY_MS);
		addOperation(MONTHS_24_AGO - 1);

		f.privacy.applyRetention();

		expect(retentionEvents().slice(-3)).toEqual([
			{ reason: 'sessions', count: 1 },
			{ reason: 'ai_operations', count: 1 },
			{ reason: 'other', count: 0 }
		]);
	});

	it('es idempotente: repetirlo no cambia nada', () => {
		f.privacy.applyRetention();
		addSession('ses_vieja', f.userId, NOW - 31 * DAY_MS);
		addOperation(MONTHS_24_AGO - 1);
		f.privacy.applyRetention();

		const second = f.privacy.applyRetention();

		expect(second).toEqual({ sessions: 0, aiOperations: 0, other: 0 });
	});

	it('no toca las tablas inmutables ni los triggers, y las IP de registro y de aceptaciones se conservan (H-17)', () => {
		const sqlite = base().database.sqlite;
		const triggersBefore = JSON.stringify(
			sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all()
		);
		const movementsBefore = db().select().from(creditMovements).all().length;
		const acceptances = db().select().from(termsAcceptances).all();
		const signupIps = db().select({ ip: user.signupIp }).from(user).all();
		addOperation(MONTHS_24_AGO - 1);

		f.privacy.applyRetention();

		expect(
			JSON.stringify(
				sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all()
			)
		).toBe(triggersBefore);
		expect(db().select().from(creditMovements).all().length).toBe(movementsBefore);
		expect(db().select().from(termsAcceptances).all()).toEqual(acceptances);
		expect(db().select({ ip: user.signupIp }).from(user).all()).toEqual(signupIps);
		expect(acceptances.some((row) => row.ip !== null)).toBe(true);
	});
});

describe('SC-016: tareas diarias de privacidad sobre una base con cuentas en cada situación', () => {
	it('ninguna cuenta con compra real se borra y no queda ningún dato personal fuera de plazo', async () => {
		const old = NOW - 4 * 365 * DAY_MS;
		const account = (id: string, over: Partial<typeof user.$inferInsert>) =>
			db()
				.insert(user)
				.values({
					id,
					name: '',
					email: `${id}@ejemplo.es`,
					emailVerified: true,
					createdAt: new Date(old - DAY_MS),
					lastActivityAt: toEpochMs(old),
					...over
				})
				.run();
		account('usr_inactiva', {});
		account('usr_compradora', {});
		base().credits.grantWelcome({ userId: 'usr_compradora', emailNormalizedHash: 'h-comp' });
		markRealPurchase(db(), 'usr_compradora');
		account('usr_sin_verificar', {
			emailVerified: false,
			createdAt: new Date(NOW - 10 * DAY_MS),
			lastActivityAt: null
		});
		account('usr_activa', { lastActivityAt: toEpochMs(NOW - DAY_MS) });
		addSession('ses_caducada', 'usr_activa', NOW - 40 * DAY_MS);
		addOperation(MONTHS_24_AGO - 1);

		// Día 0: aviso. Día 31: borrado. Cada día corren las tres tareas.
		const runDay = async () => {
			f.privacy.applyRetention();
			f.accounts.purgeUnverified(7);
			await f.privacy.processInactive();
		};
		await runDay();
		base().clock.set(NOW + 31 * DAY_MS);
		await runDay();

		const rowOf = (id: string) => db().select().from(user).where(eq(user.id, id)).get();
		expect(rowOf('usr_compradora')?.deletedAt).toBeNull();
		expect(rowOf('usr_compradora')?.email).toBe('usr_compradora@ejemplo.es');
		expect(rowOf('usr_inactiva')?.deletedAt).not.toBeNull();
		expect(rowOf('usr_sin_verificar')).toBeUndefined();
		expect(rowOf('usr_activa')?.deletedAt).toBeNull();

		// Nada personal fuera de plazo: sesiones caducadas hace más de 30 días y operaciones de más de 24 meses ligadas a alguien.
		const limit = new Date(base().clock.now() - 30 * DAY_MS);
		expect(
			db()
				.select()
				.from(session)
				.all()
				.filter((row) => row.expiresAt < limit)
		).toEqual([]);
		expect(
			db()
				.select()
				.from(aiOperations)
				.all()
				.filter((row) => row.createdAt < MONTHS_24_AGO && row.userId !== null)
		).toEqual([]);
	});
});
