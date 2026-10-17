// Modelos de salida de `credits` (contracts/api-v1.md 3.1; W19; T124): la forma exacta, sin campos internos.
import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import { balanceDto, welcomeDto } from './presenters';

describe('balanceDto', () => {
	it('expone solo los campos del Balance de la API, con sus importes en micro-créditos', () => {
		const dto = balanceDto({
			totalMicro: 1_000_000_000,
			reservedMicro: 300_000_000,
			availableMicro: 700_000_000,
			freeMicro: 1_000_000_000,
			paidMicro: 0,
			debtMicro: 0,
			nextFreeExpiry: toEpochMs(Date.UTC(2026, 10, 10))
		});

		expect(dto).toStrictEqual({
			totalMicro: 1_000_000_000,
			reservedMicro: 300_000_000,
			availableMicro: 700_000_000,
			freeMicro: 1_000_000_000,
			paidMicro: 0,
			debtMicro: 0,
			nextFreeExpiry: '2026-11-10T00:00:00.000Z'
		});
	});

	it('sin bolsas gratuitas, la próxima caducidad es null', () => {
		const dto = balanceDto({
			totalMicro: 0,
			reservedMicro: 0,
			availableMicro: 0,
			freeMicro: 0,
			paidMicro: 0,
			debtMicro: 0,
			nextFreeExpiry: null
		});

		expect(dto.nextFreeExpiry).toBeNull();
		expect(Object.keys(dto).sort()).toEqual(
			[
				'availableMicro',
				'debtMicro',
				'freeMicro',
				'nextFreeExpiry',
				'paidMicro',
				'reservedMicro',
				'totalMicro'
			].sort()
		);
	});
});

describe('welcomeDto (W19)', () => {
	it('una bienvenida concedida trae su importe y el día de caducidad en Madrid', () => {
		expect(
			welcomeDto({
				amountMicro: 1_000_000_000,
				expiresAt: toEpochMs(Date.UTC(2026, 10, 10, 12, 0, 0))
			})
		).toStrictEqual({
			status: 'granted',
			grantedMicro: 1_000_000_000,
			expiresOn: '2026-11-10'
		});
	});

	it('sin bienvenida, la forma aparece como no concedida, sin importe ni día', () => {
		expect(welcomeDto({ amountMicro: null, expiresAt: null })).toStrictEqual({
			status: 'not_granted',
			grantedMicro: 0,
			expiresOn: null
		});
	});
});
