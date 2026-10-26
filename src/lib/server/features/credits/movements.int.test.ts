// Lectura paginada de movimientos del panel contra SQLite real (T262; BE-FR-49.3, UX-09): solo los de la cuenta, filtrados por
// día de Madrid y por app, de veinticinco en veinticinco, y sin motivos internos ni ids de bolsa.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toEpochMs } from '$lib/shared/time';
import { movementsPage } from './service';

const CREDIT = 1_000_000;
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = f.addUser('usr_mov');
	f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-mov' });
});

afterEach(() => {
	f.close();
});

function useCredits(credits: number): void {
	// Un milisegundo más por operación: el orden de los movimientos es por fecha, sin empates.
	f.clock.advance(1);
	const reserved = f.credits.reserve({
		userId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(f.db, { userId }),
		amountMicro: credits * CREDIT
	});
	if (!reserved.ok) throw new Error('la reserva debía caber');
	f.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: credits * CREDIT });
}

describe('movementsPage (BE-FR-49.3)', () => {
	it('devuelve los movimientos de la cuenta, con tipo, importe y app, sin motivos ni ids de bolsa', () => {
		useCredits(10);

		const page = movementsPage(f.deps, { userId, fromMs: null, toMs: null, appId: null, page: 1 });

		expect(page.rows.map((row) => row.type)).toEqual(['usage', 'welcome']);
		expect(page.rows[0]).toMatchObject({
			type: 'usage',
			amountMicro: -10 * CREDIT,
			appId: SEEDED_APP_ID
		});
		expect(Object.keys(page.rows[0] ?? {}).sort()).toEqual([
			'amountMicro',
			'appId',
			'createdAt',
			'type'
		]);
		expect(page.pagination).toEqual({ page: 1, hasPrevious: false, hasNext: false });
	});

	it('[UX-09] ordena por fecha ascendente cuando se pide, y descendente por defecto', () => {
		useCredits(10);

		const ascending = movementsPage(f.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: null,
			page: 1,
			order: 'asc'
		});
		const byDefault = movementsPage(f.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: null,
			page: 1
		});

		expect(ascending.rows.map((row) => row.type)).toEqual(['welcome', 'usage']);
		expect(byDefault.rows.map((row) => row.type)).toEqual(['usage', 'welcome']);
	});

	it('pagina de veinticinco en veinticinco y avisa de la página siguiente', () => {
		for (let index = 0; index < 26; index += 1) useCredits(1);

		const first = movementsPage(f.deps, { userId, fromMs: null, toMs: null, appId: null, page: 1 });
		const second = movementsPage(f.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: null,
			page: 2
		});

		expect(first.rows).toHaveLength(25);
		expect(first.pagination).toEqual({ page: 1, hasPrevious: false, hasNext: true });
		expect(second.rows).toHaveLength(2);
		expect(second.pagination).toEqual({ page: 2, hasPrevious: true, hasNext: false });
	});

	it('filtra por día de Madrid: un movimiento de otro día no entra', () => {
		useCredits(3);
		const manana = toEpochMs(Date.UTC(2026, 9, 12, 8, 0, 0));

		const hoy = movementsPage(f.deps, {
			userId,
			fromMs: toEpochMs(Date.UTC(2026, 9, 11, 0, 0, 0)),
			toMs: toEpochMs(Date.UTC(2026, 9, 11, 23, 59, 59)),
			appId: null,
			page: 1
		});
		const otroDia = movementsPage(f.deps, {
			userId,
			fromMs: manana,
			toMs: null,
			appId: null,
			page: 1
		});

		expect(hoy.rows.map((row) => row.type)).toEqual(['usage', 'welcome']);
		expect(otroDia.rows).toEqual([]);
	});

	it('filtra por app y no mezcla movimientos de otra cuenta', () => {
		useCredits(2);
		const otra = f.addUser('usr_otro');
		f.credits.grantWelcome({ userId: otra, emailNormalizedHash: 'hash-otro' });

		const filtered = movementsPage(f.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: SEEDED_APP_ID,
			page: 1
		});
		const otraAppId = movementsPage(f.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: 'app_otra',
			page: 1
		});

		expect(filtered.rows.map((row) => row.type)).toEqual(['usage']);
		expect(otraAppId.rows).toEqual([]);
		expect(
			movementsPage(f.deps, {
				userId: otra,
				fromMs: null,
				toMs: null,
				appId: null,
				page: 1
			}).rows.map((row) => row.type)
		).toEqual(['welcome']);
	});
});
