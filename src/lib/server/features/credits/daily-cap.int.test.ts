// Tope diario de cuentas sin compra real contra SQLite real (FR-022, BE-FR-11.6, BE-FR-11 CA2; T198, T201, T207): los cobros
// del día de Madrid, las reservas activas y la nueva reserva no pueden superar el tope; el corte es el día de Madrid y las
// cuentas con compra real quedan exentas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';

const CREDIT = 1_000_000;

let fixture: CreditsFixture;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
});

afterEach(() => {
	fixture.close();
});

describe('tope diario de cuentas sin compra real (FR-022, BE-FR-11.6; T201)', () => {
	function reserveFor(userId: string, amountMicro: number) {
		return fixture.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(fixture.db, { userId }),
			amountMicro
		});
	}

	function grantedAccount(id: string): string {
		const userId = fixture.addUser(id);
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: `hash-${id}` });
		return userId;
	}

	it('cobros del día, reservas activas y la nueva no pueden superar el tope de 400 créditos', () => {
		const userId = grantedAccount('usr_a');
		const first = reserveFor(userId, 250 * CREDIT);
		if (!first.ok) throw new Error('la primera reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: first.holdId, realCostMicro: 250 * CREDIT });

		expect(reserveFor(userId, 200 * CREDIT)).toEqual({ ok: false, reason: 'daily_free_limit' });
		expect(reserveFor(userId, 150 * CREDIT).ok).toBe(true);
		expect(reserveFor(userId, 1)).toEqual({ ok: false, reason: 'daily_free_limit' });
	});

	it('el rechazo se registra con su motivo y sin importes', () => {
		const userId = grantedAccount('usr_a');
		const first = reserveFor(userId, 250 * CREDIT);
		if (!first.ok) throw new Error('la primera reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: first.holdId, realCostMicro: 250 * CREDIT });

		reserveFor(userId, 200 * CREDIT);

		expect(eventsNamed(fixture.logger, 'credits.hold.rejected').at(-1)?.fields).toEqual({
			reason: 'daily_free_limit'
		});
	});

	it('el corte es el día civil de Madrid: a las 23:59 cuenta el día anterior y a las 00:30 ya no', () => {
		const userId = grantedAccount('usr_a');
		const first = reserveFor(userId, 250 * CREDIT);
		if (!first.ok) throw new Error('la primera reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: first.holdId, realCostMicro: 250 * CREDIT });

		// 2026-10-11 21:59 UTC es 23:59 en Madrid (CEST): sigue siendo el mismo día.
		fixture.clock.set(Date.UTC(2026, 9, 11, 21, 59, 0));
		expect(reserveFor(userId, 200 * CREDIT)).toEqual({ ok: false, reason: 'daily_free_limit' });

		// 2026-10-11 22:30 UTC es 00:30 del 12 en Madrid: día nuevo, el tope vuelve a estar libre.
		fixture.clock.set(Date.UTC(2026, 9, 11, 22, 30, 0));
		expect(reserveFor(userId, 200 * CREDIT).ok).toBe(true);
	});

	it('una cuenta con compra real queda exenta del tope', () => {
		const userId = grantedAccount('usr_a');
		const first = reserveFor(userId, 250 * CREDIT);
		if (!first.ok) throw new Error('la primera reserva debía caber');
		fixture.credits.chargeAndRelease({ holdId: first.holdId, realCostMicro: 250 * CREDIT });
		markRealPurchase(fixture.db, userId);

		expect(reserveFor(userId, 450 * CREDIT).ok).toBe(true);
	});

	it('el saldo insuficiente se sigue respondiendo como tal, antes que el tope', () => {
		const userId = fixture.addUser('usr_sin_saldo');

		expect(reserveFor(userId, 1 * CREDIT)).toMatchObject({
			ok: false,
			reason: 'insufficient_balance'
		});
	});
});
