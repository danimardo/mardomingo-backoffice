// Lectura paginada del consumo del panel contra SQLite real (T263; BE-FR-49.4): solo operaciones de la cuenta, filtradas por
// app y por día, de veinticinco en veinticinco, con su estado y los créditos cobrados.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toMicro } from '$lib/shared/money';
import { aiOperations } from './schema';
import { consumptionPage } from './consumption';

let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = f.addUser('usr_consumo');
});

afterEach(() => {
	f.close();
});

function operation(owner: string, status: 'ok' | 'provider_error', charged: number): string {
	const id = insertInFlightOperation(f.db, { userId: owner });
	f.clock.advance(1);
	f.db
		.update(aiOperations)
		.set({ status, chargedMicro: toMicro(charged), completedAt: f.clock.now() })
		.where(eq(aiOperations.id, id))
		.run();
	return id;
}

describe('consumptionPage (BE-FR-49.4)', () => {
	it('devuelve las operaciones de la cuenta con su estado y lo cobrado, sin las de otra cuenta', () => {
		operation(userId, 'ok', 776_480);
		operation(userId, 'provider_error', 0);
		operation(f.addUser('usr_ajeno'), 'ok', 1_000_000);

		const page = consumptionPage(f.db, { userId, fromMs: null, toMs: null, appId: null, page: 1 });

		expect(page.rows.map((row) => row.status)).toEqual(['provider_error', 'ok']);
		expect(page.rows[1]).toMatchObject({
			status: 'ok',
			chargedMicro: 776_480,
			appId: SEEDED_APP_ID
		});
		expect(page.pagination).toEqual({ page: 1, hasPrevious: false, hasNext: false });
	});

	it('pagina de veinticinco en veinticinco', () => {
		for (let index = 0; index < 26; index += 1) operation(userId, 'ok', 1_000);

		const second = consumptionPage(f.db, {
			userId,
			fromMs: null,
			toMs: null,
			appId: null,
			page: 2
		});

		expect(second.rows).toHaveLength(1);
		expect(second.pagination).toEqual({ page: 2, hasPrevious: true, hasNext: false });
	});

	it('[BE-FR-63/CA2] filtra por app', () => {
		operation(userId, 'ok', 1_000);

		expect(
			consumptionPage(f.db, { userId, fromMs: null, toMs: null, appId: SEEDED_APP_ID, page: 1 })
				.rows
		).toHaveLength(1);
		expect(
			consumptionPage(f.db, { userId, fromMs: null, toMs: null, appId: 'app_otra', page: 1 }).rows
		).toEqual([]);
	});
});
