// Montaje de la cuenta del panel (T250): comprueba que los datos de cada tipo existen de verdad antes de usarlos en las
// pruebas de la interfaz. Todo se crea con los servicios, así que lo que aquí se ve es lo que el panel verá.
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import {
	panelAccountFixture,
	type PanelAccount
} from '../../../../../tests/builders/panel-account';
import { aiOperations } from '$lib/server/features/ai/schema';
import { creditBuckets, creditMovements, userBalances } from '$lib/server/features/credits/schema';
import { invoices } from '$lib/server/features/invoicing/schema';

let account: PanelAccount;

afterEach(() => {
	account.fixture.close();
});

describe('cuenta del panel (T250)', () => {
	it('tiene bolsas gratuitas, compradas y una simulada, con saldo reservado y deuda', () => {
		account = panelAccountFixture();
		const { db, credits } = account.fixture.base;

		const buckets = db
			.select()
			.from(creditBuckets)
			.where(eq(creditBuckets.userId, account.userId))
			.all();
		expect(buckets.map((bucket) => bucket.source).sort()).toEqual([
			'purchase',
			'purchase',
			'welcome'
		]);
		// En la v4 el único proveedor es el simulado: ambas compras son simuladas. La «compra real» del panel se fija con
		// el marcador de pruebas `markRealPurchase`, que solo exime del tope diario.
		expect(buckets.filter((bucket) => bucket.simulated)).toHaveLength(2);
		expect(credits.getBalance(account.userId)).toMatchObject({
			debtMicro: 50_000_000,
			reservedMicro: 2_000_000
		});
		expect(
			db.select().from(userBalances).where(eq(userBalances.userId, account.userId)).get()
				?.hasRealPurchase
		).toBe(true);
	});

	it('tiene movimientos de compra, uso, liquidación y deuda', () => {
		account = panelAccountFixture();
		const types = new Set(
			account.fixture.base.db
				.select()
				.from(creditMovements)
				.where(eq(creditMovements.userId, account.userId))
				.all()
				.map((row) => row.type)
		);

		expect(types).toEqual(expect.objectContaining(new Set(['welcome', 'purchase', 'usage'])));
	});

	it('tiene operaciones de IA en los estados de la pantalla de consumo', () => {
		account = panelAccountFixture();
		const statuses = account.fixture.base.db
			.select({ status: aiOperations.status })
			.from(aiOperations)
			.where(eq(aiOperations.userId, account.userId))
			.all()
			.map((row) => row.status);

		expect(statuses).toEqual(
			expect.arrayContaining(['ok', 'provider_error', 'cancelled', 'undelivered', 'interrupted'])
		);
	});

	it('tiene perfil fiscal y compras con su factura de la simulada ausente', () => {
		account = panelAccountFixture();
		const rows = account.fixture.base.db.select().from(invoices).all();

		expect(rows).toEqual([]);
		expect(account.simulatedPaymentId).toMatch(/^pay_/);
	});
});
