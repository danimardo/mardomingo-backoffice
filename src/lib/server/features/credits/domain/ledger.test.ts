// Reglas del dominio de créditos (BE-FR-12–18, BE-FR-71; data-model.md 5.1–5.2; T117). Funciones puras: sin base de datos.
import { describe, expect, it } from 'vitest';
import {
	applyCredit,
	applyExpiry,
	applyNegativeAdjustment,
	applyUsage,
	applyWelcome,
	balanceOf,
	canGrantWelcome,
	canReserve,
	consumptionOrder,
	reconstruct,
	type Bucket,
	type Line,
	type LedgerState
} from './ledger';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000;
const MAX_DEBT = 200_000_000;

function bucket(overrides: Partial<Bucket> & Pick<Bucket, 'id'>): Bucket {
	return {
		kind: 'free',
		source: 'welcome',
		initial: 0,
		remaining: 0,
		expiresAt: NOW + 30 * DAY,
		createdAt: NOW - DAY,
		...overrides
	};
}

function stateOf(buckets: readonly Bucket[], debt = 0): LedgerState {
	return { buckets, debt };
}

describe('bienvenida (BE-FR-12, BE-FR-11.5, D10)', () => {
	it('una forma normalizada ya concedida deniega la bienvenida', () => {
		expect(canGrantWelcome({ hashGranted: true, accountHasWelcome: false })).toEqual({
			ok: false,
			reason: 'hash_granted'
		});
	});

	it('una cuenta que ya tiene bienvenida no la recibe otra vez', () => {
		expect(canGrantWelcome({ hashGranted: false, accountHasWelcome: true })).toEqual({
			ok: false,
			reason: 'account_has_welcome'
		});
	});

	it('una cuenta nueva y una forma sin conceder reciben bienvenida', () => {
		expect(canGrantWelcome({ hashGranted: false, accountHasWelcome: false })).toEqual({ ok: true });
	});

	it('la bienvenida crea una bolsa free con su importe, caducidad y movimiento welcome', () => {
		const result = applyWelcome(stateOf([]), {
			id: 'bkt_1',
			amount: 1_000_000_000,
			expiresAt: NOW + 30 * DAY,
			createdAt: NOW
		});

		expect(result.state.buckets).toEqual([
			{
				id: 'bkt_1',
				kind: 'free',
				source: 'welcome',
				initial: 1_000_000_000,
				remaining: 1_000_000_000,
				expiresAt: NOW + 30 * DAY,
				createdAt: NOW
			}
		]);
		expect(result.lines).toEqual([{ type: 'welcome', amount: 1_000_000_000, bucketId: 'bkt_1' }]);
	});
});

describe('orden de consumo (BE-FR-14)', () => {
	it('free antes que paid; entre free, la que caduca antes; entre paid, la más antigua', () => {
		const buckets = [
			bucket({ id: 'freeLater', remaining: 5, expiresAt: NOW + 100 }),
			bucket({ id: 'freeSoon', remaining: 3, expiresAt: NOW + 50 }),
			bucket({
				id: 'paidNew',
				kind: 'paid',
				source: 'purchase',
				remaining: 4,
				expiresAt: null,
				createdAt: 10
			}),
			bucket({
				id: 'paidOld',
				kind: 'paid',
				source: 'purchase',
				remaining: 10,
				expiresAt: null,
				createdAt: 5
			})
		];

		expect(consumptionOrder(buckets).map((item) => item.id)).toEqual([
			'freeSoon',
			'freeLater',
			'paidOld',
			'paidNew'
		]);
	});

	it('una bolsa gratuita sin caducidad (el esquema no la admite) se consume después de las que caducan, y ordena de forma estable', () => {
		const buckets = [
			bucket({ id: 'sinCaducidadB', remaining: 1, expiresAt: null }),
			bucket({ id: 'sinCaducidadA', remaining: 1, expiresAt: null }),
			bucket({ id: 'conCaducidad', remaining: 1, expiresAt: NOW + 50 })
		];

		expect(consumptionOrder(buckets).map((item) => item.id)).toEqual([
			'conCaducidad',
			'sinCaducidadA',
			'sinCaducidadB'
		]);
	});

	it('consumir toma de las bolsas en ese orden y deja el resto sin cubrir', () => {
		const state = stateOf([
			bucket({ id: 'freeSoon', remaining: 3, expiresAt: NOW + 50 }),
			bucket({ id: 'freeLater', remaining: 5, expiresAt: NOW + 100 })
		]);

		const result = applyUsage(state, { amount: 10, maxDebt: MAX_DEBT });

		expect(result.lines.filter((line) => line.bucketId !== null)).toEqual([
			{ type: 'usage', amount: -3, bucketId: 'freeSoon' },
			{ type: 'usage', amount: -5, bucketId: 'freeLater' }
		]);
	});
});

describe('deuda (BE-FR-17, D2, D7, D8, D13, D14)', () => {
	it('el cobro que supera el saldo pasa el exceso a deuda, con una línea sin bolsa', () => {
		const state = stateOf([bucket({ id: 'b1', remaining: 55_000_000 })]);

		const result = applyUsage(state, { amount: 58_236_000, maxDebt: MAX_DEBT });

		expect(result.lines).toEqual([
			{ type: 'usage', amount: -55_000_000, bucketId: 'b1' },
			{ type: 'usage', amount: -3_236_000, bucketId: null }
		]);
		expect(result.state.debt).toBe(3_236_000);
		expect(result.absorbed).toBe(0);
	});

	it('la deuda nunca pasa de max_debt: el exceso lo absorbe el administrador y no es un movimiento', () => {
		const result = applyUsage(stateOf([], 0), { amount: 10_000_000, maxDebt: 2_000_000 });

		expect(result.state.debt).toBe(2_000_000);
		expect(result.absorbed).toBe(8_000_000);
		expect(result.lines).toEqual([{ type: 'usage', amount: -2_000_000, bucketId: null }]);
	});

	it('una entrada paid liquida primero la deuda como par que suma 0 (D13)', () => {
		const state = stateOf([], 3_236_000);

		const result = applyCredit(state, {
			id: 'bkt_p',
			kind: 'paid',
			source: 'purchase',
			amount: 5_000_000_000,
			expiresAt: null,
			createdAt: NOW,
			type: 'purchase'
		});

		expect(result.state.debt).toBe(0);
		expect(result.state.buckets.find((item) => item.id === 'bkt_p')?.remaining).toBe(4_996_764_000);
		const pair = result.lines.filter((line) => line.type === 'debt_settlement');
		expect(pair).toHaveLength(2);
		expect(pair.reduce((sum, line) => sum + line.amount, 0)).toBe(0);
	});

	it('la pérdida por deuda liquidada con un ajuste gratuito se informa (D14)', () => {
		const result = applyCredit(stateOf([], 2_000_000), {
			id: 'bkt_f',
			kind: 'free',
			source: 'adjustment',
			amount: 10_000_000,
			expiresAt: NOW + 30 * DAY,
			createdAt: NOW,
			type: 'adjustment'
		});

		expect(result.absorbedLossMicro).toBe(2_000_000);
	});
});

describe('reserva (BE-FR-71, D6)', () => {
	it('con deuda abierta no se crea ninguna reserva', () => {
		expect(
			canReserve({
				balance: 100_000_000,
				reserved: 0,
				debt: 1,
				maxDebt: MAX_DEBT,
				minBalance: 5_000_000,
				amount: 1
			})
		).toEqual({ ok: false, reason: 'debt_open' });
	});

	it('la reserva cabe si amount ≤ disponible + (max_debt − deuda) y disponible ≥ min_balance', () => {
		const ok = canReserve({
			balance: 10_000_000,
			reserved: 0,
			debt: 0,
			maxDebt: MAX_DEBT,
			minBalance: 5_000_000,
			amount: 200_000_000
		});
		expect(ok).toEqual({ ok: true });
	});

	it('una reserva que no cabe devuelve el importe exigido y el disponible', () => {
		expect(
			canReserve({
				balance: 10_000_000,
				reserved: 0,
				debt: 0,
				maxDebt: MAX_DEBT,
				minBalance: 5_000_000,
				amount: 210_000_001
			})
		).toEqual({
			ok: false,
			reason: 'insufficient_balance',
			requiredMicro: 210_000_001,
			availableMicro: 10_000_000
		});
	});

	it('por debajo de min_balance_to_operate no se reserva aunque quepa el importe', () => {
		expect(
			canReserve({
				balance: 4_000_000,
				reserved: 0,
				debt: 0,
				maxDebt: MAX_DEBT,
				minBalance: 5_000_000,
				amount: 1
			})
		).toMatchObject({ ok: false, reason: 'insufficient_balance' });
	});

	it('las reservas abiertas restan del disponible (D5)', () => {
		expect(
			canReserve({
				balance: 10_000_000,
				reserved: 6_000_000,
				debt: 0,
				maxDebt: 0,
				minBalance: 0,
				amount: 5_000_000
			})
		).toMatchObject({ ok: false, reason: 'insufficient_balance', availableMicro: 4_000_000 });
	});
});

describe('ajustes manuales (BE-FR-18, D-16)', () => {
	it('un ajuste negativo mayor que el saldo disponible se rechaza y no crea deuda', () => {
		const state = stateOf([
			bucket({ id: 'p1', kind: 'paid', source: 'purchase', remaining: 5_000_000, expiresAt: null })
		]);

		expect(
			applyNegativeAdjustment(state, { kind: 'paid', amount: 6_000_000, available: 5_000_000 })
		).toEqual({ ok: false, reason: 'exceeds_available' });
	});

	it('un ajuste negativo solo reduce bolsas del tipo indicado', () => {
		const state = stateOf([
			bucket({ id: 'f1', remaining: 5_000_000 }),
			bucket({
				id: 'p1',
				kind: 'paid',
				source: 'purchase',
				remaining: 10_000_000,
				expiresAt: null,
				createdAt: 1
			})
		]);

		const result = applyNegativeAdjustment(state, {
			kind: 'paid',
			amount: 6_000_000,
			available: 15_000_000
		});

		expect(result).toMatchObject({ ok: true });
		if (result.ok) {
			expect(result.lines).toEqual([{ type: 'adjustment', amount: -6_000_000, bucketId: 'p1' }]);
			expect(result.state.debt).toBe(0);
		}
	});

	it('un ajuste negativo gratuito mayor que las bolsas gratuitas se rechaza aunque haya paid', () => {
		const state = stateOf([
			bucket({ id: 'f1', remaining: 5_000_000 }),
			bucket({
				id: 'p1',
				kind: 'paid',
				source: 'purchase',
				remaining: 10_000_000,
				expiresAt: null,
				createdAt: 1
			})
		]);

		expect(
			applyNegativeAdjustment(state, { kind: 'free', amount: 6_000_000, available: 15_000_000 })
		).toEqual({ ok: false, reason: 'exceeds_available' });
	});
});

describe('caducidad (BE-FR-16)', () => {
	it('pone a cero solo las bolsas free caducadas, con movimiento expiry', () => {
		const state = stateOf([
			bucket({ id: 'vencida', remaining: 4_000_000, expiresAt: NOW - 1 }),
			bucket({ id: 'vigente', remaining: 3_000_000, expiresAt: NOW + DAY }),
			bucket({
				id: 'pagada',
				kind: 'paid',
				source: 'purchase',
				remaining: 9_000_000,
				expiresAt: null,
				createdAt: 1
			})
		]);

		const result = applyExpiry(state, NOW);

		expect(result.lines).toEqual([{ type: 'expiry', amount: -4_000_000, bucketId: 'vencida' }]);
		expect(result.state.buckets.find((item) => item.id === 'vencida')?.remaining).toBe(0);
		expect(result.state.buckets.find((item) => item.id === 'vigente')?.remaining).toBe(3_000_000);
	});
});

describe('saldo y reconstrucción desde el ledger (BE-FR-15 CA1, D1–D3)', () => {
	it('[BE-FR-15/CA1] el saldo es bolsas menos deuda, y reconstruir desde los movimientos da lo mismo', () => {
		const lines: Line[] = [];
		const welcome = applyWelcome(stateOf([]), {
			id: 'w',
			amount: 1_000_000_000,
			expiresAt: NOW + DAY,
			createdAt: NOW
		});
		lines.push(...welcome.lines);
		const usage = applyUsage(welcome.state, { amount: 1_300_000_000, maxDebt: 1_000_000_000 });
		lines.push(...usage.lines);
		expect(balanceOf(usage.state)).toBe(-300_000_000);
		expect(reconstruct(lines)).toBe(balanceOf(usage.state));
	});
});
