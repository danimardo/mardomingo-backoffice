// Servicio de créditos contra SQLite real (T122; BE-FR-11.5, 12–18, 71; SC-002; D8, D10, D13, D14, D-16; Historias 15.19):
// bienvenida una sola vez, concurrencia de las reservas, cobro con deuda hasta max_debt, arranque con reservas abiertas,
// ajuste con liquidación de deuda y auditoría, ajuste negativo rechazado, caducidades y saldo desglosado.
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAudit } from '$lib/server/features/audit/schema';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import {
	adjustmentKeys,
	creditBuckets,
	creditHolds,
	creditMovements,
	userBalances,
	welcomeGrants
} from './schema';
import { toEpochMs } from '$lib/shared/time';

const CREDIT = 1_000_000;
const WELCOME = 1000 * CREDIT;
const DAY = 24 * 60 * 60 * 1000;

let fixture: CreditsFixture;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
});

afterEach(() => {
	fixture.close();
});

function movementsOf(userId: string) {
	return fixture.db.select().from(creditMovements).where(eq(creditMovements.userId, userId)).all();
}

function balanceRow(userId: string) {
	return fixture.db.select().from(userBalances).where(eq(userBalances.userId, userId)).get();
}

describe('bienvenida (BE-FR-12, BE-FR-11.5, D10)', () => {
	it('se concede una sola vez: movimiento welcome, marca de la forma y fila de saldo', () => {
		const userId = fixture.addUser('usr_a');

		const first = fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });

		expect(first).toMatchObject({ status: 'granted', amountMicro: WELCOME });
		expect(movementsOf(userId).map((row) => [row.type, row.amountMicro])).toEqual([
			['welcome', WELCOME]
		]);
		expect(
			fixture.db
				.select()
				.from(welcomeGrants)
				.all()
				.map((row) => row.emailNormalizedHash)
		).toEqual(['hash-uno']);
		expect(balanceRow(userId)).toMatchObject({ debtMicro: 0, hasRealPurchase: false });
	});

	it('una forma ya concedida no vuelve a recibirla, aunque sea otra cuenta (CA1 de BE-FR-11.5)', () => {
		const first = fixture.addUser('usr_a');
		const second = fixture.addUser('usr_b');
		fixture.credits.grantWelcome({ userId: first, emailNormalizedHash: 'misma-forma' });

		const outcome = fixture.credits.grantWelcome({
			userId: second,
			emailNormalizedHash: 'misma-forma'
		});

		expect(outcome).toEqual({ status: 'denied', reason: 'hash_granted' });
		expect(movementsOf(second)).toHaveLength(0);
		expect(eventsNamed(fixture.logger, 'credits.welcome.denied').at(-1)?.fields).toEqual({
			reason: 'hash_granted'
		});
	});

	it('[BE-FR-63/CA1] una cuenta que ya tiene bienvenida no recibe otra', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });

		expect(fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-dos' })).toEqual({
			status: 'denied',
			reason: 'account_has_welcome'
		});
	});
});

describe('reservas bajo concurrencia (BE-FR-71 CA1, SC-002)', () => {
	it('[BE-FR-71/CA1] con saldo para tres operaciones, veinte reservas simultáneas dan exactamente tres', async () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		// Esta prueba mide el saldo bajo concurrencia. El tope diario de cuentas sin compra real tiene sus propias pruebas
		// (bloque «tope diario»), así que aquí la cuenta tiene compra real y queda exenta del tope.
		fixture.db
			.update(userBalances)
			.set({ hasRealPurchase: true })
			.where(eq(userBalances.userId, userId))
			.run();
		const operations = Array.from({ length: 20 }, () =>
			insertInFlightOperation(fixture.db, { userId })
		);

		const outcomes = await Promise.all(
			operations.map(async (operationId) => {
				await Promise.resolve();
				return fixture.credits.reserve({
					userId,
					appId: SEEDED_APP_ID,
					operationId,
					amountMicro: 400 * CREDIT
				});
			})
		);

		expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(3);
		expect(
			outcomes.filter((outcome) => !outcome.ok && outcome.reason === 'insufficient_balance')
		).toHaveLength(17);
		const holds = fixture.db.select().from(creditHolds).where(eq(creditHolds.userId, userId)).all();
		expect(holds).toHaveLength(3);
		expect(holds.reduce((sum, hold) => sum + hold.amountMicro, 0)).toBe(1200 * CREDIT);
	});

	it('con deuda abierta no se reserva nada (D6)', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const first = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 400 * CREDIT
		});
		if (!first.ok) throw new Error('la primera reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: first.holdId, realCostMicro: 1205 * CREDIT });

		const outcome = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 1
		});

		expect(outcome).toEqual({ ok: false, reason: 'debt_open' });
	});
});

describe('cobro con deuda (BE-FR-17, D2, D8)', () => {
	it('el exceso pasa a deuda hasta max_debt y lo que pasa de ahí lo absorbe el administrador, sin movimiento', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const reserved = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 400 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');

		const charge = fixture.credits.chargeAndRelease({
			holdId: reserved.holdId,
			realCostMicro: 1205 * CREDIT
		});

		expect(charge).toEqual({
			ok: true,
			chargedMicro: 1200 * CREDIT,
			absorbedMicro: 5 * CREDIT,
			lowBalance: null
		});
		expect(balanceRow(userId)?.debtMicro).toBe(200 * CREDIT);
		expect(fixture.credits.getBalance(userId)).toMatchObject({
			totalMicro: -200 * CREDIT,
			reservedMicro: 0
		});
		expect(
			fixture.db.select().from(creditHolds).where(eq(creditHolds.id, reserved.holdId)).get()
		).toMatchObject({
			releaseReason: 'consumed'
		});
		expect(eventsNamed(fixture.logger, 'credits.debt.created')).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'credits.debt.absorbed')).toHaveLength(1);
	});
});

describe('reinicio con reservas abiertas (BE-FR-71)', () => {
	it('se liberan como interrumpidas, sin cobro ni movimiento', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 100 * CREDIT
		});
		fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 100 * CREDIT
		});
		const before = movementsOf(userId).length;

		const released = fixture.credits.releaseOpenHoldsOnStartup();

		expect(released).toBe(2);
		expect(
			fixture.db
				.select()
				.from(creditHolds)
				.where(eq(creditHolds.userId, userId))
				.all()
				.map((row) => row.releaseReason)
		).toEqual(['interrupted', 'interrupted']);
		expect(movementsOf(userId)).toHaveLength(before);
		expect(eventsNamed(fixture.logger, 'credits.hold.released_on_startup').at(-1)?.fields).toEqual({
			count: 2
		});
	});
});

describe('ajustes del administrador (BE-FR-18, D13, D-16)', () => {
	it('un ajuste positivo liquida primero la deuda y deja su entrada en la auditoría, en la misma transacción', () => {
		const userId = fixture.addUser('usr_a');
		const adminId = fixture.addUser('usr_admin', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const reserved = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 400 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 1205 * CREDIT });

		const outcome = fixture.credits.adjust({
			idempotencyKey: randomUUID(),
			adminId,
			userId,
			direction: 'credit',
			kind: 'free',
			amountMicro: 300 * CREDIT,
			reason: 'Compensación por incidencia'
		});

		expect(outcome).toMatchObject({ ok: true });
		expect(balanceRow(userId)?.debtMicro).toBe(0);
		expect(fixture.credits.getBalance(userId).totalMicro).toBe(100 * CREDIT);
		const settlement = movementsOf(userId).filter((row) => row.type === 'debt_settlement');
		expect(settlement.map((row) => row.amountMicro).sort((a, b) => a - b)).toEqual([
			-200 * CREDIT,
			200 * CREDIT
		]);
		const audit = fixture.db
			.select()
			.from(adminAudit)
			.where(and(eq(adminAudit.adminId, adminId), eq(adminAudit.action, 'credits.adjust')))
			.all();
		expect(audit).toHaveLength(1);
		expect(audit[0]).toMatchObject({ entityId: userId, reason: 'Compensación por incidencia' });
	});

	it('[BE-FR-18/CA1] un ajuste negativo mayor que el disponible se rechaza sin escribir nada (D-16)', () => {
		const userId = fixture.addUser('usr_a');
		const adminId = fixture.addUser('usr_admin', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const before = movementsOf(userId).length;

		const outcome = fixture.credits.adjust({
			idempotencyKey: randomUUID(),
			adminId,
			userId,
			direction: 'debit',
			kind: 'free',
			amountMicro: 1200 * CREDIT,
			reason: 'Retirada'
		});

		expect(outcome).toEqual({ ok: false, reason: 'exceeds_available' });
		expect(movementsOf(userId)).toHaveLength(before);
		expect(eventsNamed(fixture.logger, 'credits.adjustment.rejected').at(-1)?.fields).toEqual({
			reason: 'exceeds_available'
		});
	});
});

describe('caducidades (BE-FR-16, BE-FR-71)', () => {
	it('la bolsa gratuita caducada se pone a cero con su movimiento expiry', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });

		fixture.clock.advance(31 * DAY);
		const touched = fixture.credits.expireBuckets();

		expect(touched).toBe(1);
		expect(
			movementsOf(userId)
				.filter((row) => row.type === 'expiry')
				.map((row) => row.amountMicro)
		).toEqual([-WELCOME]);
		expect(fixture.credits.getBalance(userId)).toMatchObject({
			totalMicro: 0,
			freeMicro: 0,
			nextFreeExpiry: null
		});
	});

	it('las reservas que superan hold_ttl_seconds se liberan sin cobro; las recientes siguen', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const old = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 100 * CREDIT
		});
		fixture.clock.advance(5 * 60 * 1000);
		const recent = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 100 * CREDIT
		});
		if (!old.ok || !recent.ok) throw new Error('las reservas debían caber');
		const before = movementsOf(userId).length;

		fixture.clock.advance(301 * 1000);
		const expired = fixture.credits.expireHolds();

		expect(expired).toBe(1);
		expect(
			fixture.db.select().from(creditHolds).where(eq(creditHolds.id, old.holdId)).get()
				?.releaseReason
		).toBe('expired');
		expect(
			fixture.db.select().from(creditHolds).where(eq(creditHolds.id, recent.holdId)).get()
				?.releasedAt
		).toBeNull();
		expect(movementsOf(userId)).toHaveLength(before);
		expect(eventsNamed(fixture.logger, 'credits.hold.expired')).toHaveLength(1);
	});
});

describe('saldo desglosado (BE-FR-71 CA2)', () => {
	it('[BE-FR-71/CA2] distingue total, reservado y disponible, y el tipo de cada bolsa', () => {
		const userId = fixture.addUser('usr_a');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 300 * CREDIT
		});

		expect(fixture.credits.getBalance(userId)).toEqual({
			totalMicro: WELCOME,
			reservedMicro: 300 * CREDIT,
			availableMicro: 700 * CREDIT,
			freeMicro: WELCOME,
			paidMicro: 0,
			debtMicro: 0,
			nextFreeExpiry:
				fixture.db.select().from(creditBuckets).where(eq(creditBuckets.userId, userId)).get()
					?.expiresAt ?? null
		});
	});
});

describe('eventos (Historias 15.19)', () => {
	it('ningún evento de créditos lleva importes, saldos ni emails', () => {
		const userId = fixture.addUser('usr_a');
		const adminId = fixture.addUser('usr_admin', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-uno' });
		const reserved = fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro: 400 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 1205 * CREDIT });
		fixture.credits.adjust({
			idempotencyKey: randomUUID(),
			adminId,
			userId,
			direction: 'credit',
			kind: 'paid',
			amountMicro: 50 * CREDIT,
			reason: 'Prueba'
		});

		const credit = fixture.logger.events.filter((item) => item.event.startsWith('credits.'));
		expect(credit.length).toBeGreaterThan(0);
		for (const item of credit) {
			for (const key of Object.keys(item.fields)) {
				expect(key).not.toMatch(/micro|amount|balance|debt|email/i);
			}
		}
		expect(JSON.stringify(credit)).not.toContain('usr_a@ejemplo.es');
	});
});

describe('ajustes idempotentes (T307, 15.12)', () => {
	it('un reenvío con la misma clave no vuelve a aplicar el ajuste ni a auditarlo', () => {
		const userId = fixture.addUser('usr_idem');
		const adminId = fixture.addUser('usr_admin_idem', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-idem' });
		const antes = fixture.credits.getBalance(userId).totalMicro;
		const idempotencyKey = randomUUID();
		const ajuste = {
			idempotencyKey,
			adminId,
			userId,
			direction: 'credit' as const,
			kind: 'free' as const,
			amountMicro: 5 * CREDIT,
			expiresAt: null,
			reason: 'Compensación'
		};

		expect(fixture.credits.adjust(ajuste)).toMatchObject({ ok: true });
		expect(fixture.credits.adjust(ajuste)).toEqual({ ok: false, reason: 'repeated' });

		expect(fixture.credits.getBalance(userId).totalMicro).toBe(antes + 5 * CREDIT);
		expect(
			fixture.db
				.select()
				.from(adminAudit)
				.where(and(eq(adminAudit.adminId, adminId), eq(adminAudit.action, 'credits.adjust')))
				.all()
		).toHaveLength(1);
	});

	it('un ajuste rechazado no consume su clave: el reintento con la misma clave sí se aplica', () => {
		const userId = fixture.addUser('usr_idem_retry');
		const adminId = fixture.addUser('usr_admin_retry', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-idem-retry' });
		const idempotencyKey = randomUUID();
		const base = {
			idempotencyKey,
			adminId,
			userId,
			direction: 'debit' as const,
			kind: 'free' as const,
			reason: 'Corrección'
		};

		expect(fixture.credits.adjust({ ...base, amountMicro: 999_999 * CREDIT })).toEqual({
			ok: false,
			reason: 'exceeds_available'
		});
		expect(fixture.credits.adjust({ ...base, amountMicro: 1 * CREDIT })).toMatchObject({
			ok: true
		});
	});
});

describe('retención de las claves de ajustes (T307, 400 días)', () => {
	it('borra las claves anteriores al corte y conserva las recientes', () => {
		const userId = fixture.addUser('usr_retencion_claves');
		const adminId = fixture.addUser('usr_admin_retencion', 'admin');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-retencion' });
		const antigua = randomUUID();
		const reciente = randomUUID();
		const base = {
			adminId,
			userId,
			direction: 'credit' as const,
			kind: 'free' as const,
			expiresAt: null,
			amountMicro: 1 * CREDIT,
			reason: 'Retención'
		};
		fixture.credits.adjust({ ...base, idempotencyKey: antigua });
		fixture.db
			.update(adjustmentKeys)
			.set({ createdAt: toEpochMs(fixture.clock.now() - 500 * 24 * 60 * 60 * 1000) })
			.where(eq(adjustmentKeys.key, antigua))
			.run();
		fixture.credits.adjust({ ...base, idempotencyKey: reciente });

		const corte = toEpochMs(fixture.clock.now() - 400 * 24 * 60 * 60 * 1000);
		expect(fixture.credits.purgeAdjustmentKeys(corte)).toBe(1);
		expect(
			fixture.db.select().from(adjustmentKeys).where(eq(adjustmentKeys.key, antigua)).get()
		).toBeUndefined();
		expect(
			fixture.db.select().from(adjustmentKeys).where(eq(adjustmentKeys.key, reciente)).get()
		).toBeDefined();
	});
});
