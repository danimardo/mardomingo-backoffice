// Facturas de una cuenta para el panel contra SQLite real (T268; BE-FR-75): `invoicing` las lista a partir de las compras que
// le da `payments`, en orden de emisión y sin datos internos (sin id de proveedor ni clave de emisión).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeInvoicing } from '$lib/server/adapters/invoicing/fake';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { insertCompletedPurchase } from '../../../../../tests/builders/purchases';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { invoicesFor, issueForPayment } from './service';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let deps: {
	db: CreditsFixture['db'];
	logger: CreditsFixture['logger'];
	clock: CreditsFixture['clock'];
	ids: ReturnType<typeof createIdGenerator>;
	provider: ReturnType<typeof createFakeInvoicing>;
};

beforeEach(() => {
	f = creditsFixture(NOW);
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		ids: createIdGenerator(seededRandomBytes(71)),
		provider: createFakeInvoicing()
	};
});

afterEach(() => {
	f.close();
});

describe('invoicesFor (BE-FR-75)', () => {
	it('lista las facturas de las compras indicadas, sin datos internos', () => {
		const userId = f.addUser('usr_facturas');
		insertCompletedPurchase(f.db, {
			paymentId: 'pay_fac_1',
			userId,
			creditsMicro: 1_000_000,
			simulated: false,
			now: NOW
		});
		issueForPayment(deps, {
			paymentId: 'pay_fac_1',
			userId,
			simulated: false,
			kind: 'simplified',
			amountEurCents: 1000,
			issueKey: 'payment:pay_fac_1:initial'
		});

		const list = invoicesFor(deps, ['pay_fac_1', 'pay_sin_facturas']);

		expect(list).toEqual([
			expect.objectContaining({
				kind: 'simplified',
				number: '000001',
				amountEurCents: 1000,
				series: 'A'
			})
		]);
		expect(Object.keys(list[0] ?? {}).sort()).toEqual([
			'amountEurCents',
			'id',
			'issuedAt',
			'kind',
			'number',
			'series'
		]);
	});

	it('sin compras no hay facturas', () => {
		expect(invoicesFor(deps, [])).toEqual([]);
	});
});
