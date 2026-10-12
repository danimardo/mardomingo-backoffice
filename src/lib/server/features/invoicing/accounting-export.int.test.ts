// Exportación contable contra SQLite real (T240; BE-FR-76): las ventas llevan el número de factura y el NIF de la cuenta, las
// compras simuladas no aparecen, el archivo de ventas lleva BOM para hoja de cálculo y la exportación queda registrada.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeInvoicing } from '$lib/server/adapters/invoicing/fake';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { insertCompletedPurchase } from '../../../../../tests/builders/purchases';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { accountingExport, issueForPayment, saveBillingProfile } from './service';
import type { PaymentFact } from './domain/accounting-csv';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
const PROFILE = {
	kind: 'individual' as const,
	legalName: 'Ana Pérez',
	taxId: '12345678Z',
	address: 'Calle Mayor 1',
	postalCode: '28013',
	city: 'Madrid',
	country: 'ES'
};

let f: CreditsFixture;
let deps: ReturnType<typeof makeDeps>;

function makeDeps() {
	return {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		ids: createIdGenerator(seededRandomBytes(61)),
		provider: createFakeInvoicing()
	};
}

function fact(paymentId: string, userId: string, simulated: boolean): PaymentFact {
	return {
		paymentId,
		userId,
		date: '2026-10-11',
		country: 'ES',
		baseEurCents: 826,
		vatEurCents: 174,
		totalEurCents: 1000,
		refundedEurCents: 0,
		chargebackEurCents: 0,
		simulated,
		providerRef: `ref_${paymentId}`
	};
}

beforeEach(() => {
	f = creditsFixture(NOW);
	deps = makeDeps();
});

afterEach(() => {
	f.close();
});

describe('exportación contable (BE-FR-76)', () => {
	it('las ventas llevan la factura y el NIF, y las simuladas no aparecen', () => {
		const userId = f.addUser('usr_contable');
		insertCompletedPurchase(f.db, {
			paymentId: 'pay_real',
			userId,
			creditsMicro: 10_500_000_000,
			simulated: false,
			now: NOW
		});
		insertCompletedPurchase(f.db, {
			paymentId: 'pay_sim',
			userId,
			creditsMicro: 10_500_000_000,
			simulated: true,
			now: NOW
		});
		// Cuenta con perfil fiscal y factura emitida para la compra real.
		saveBillingProfile(deps, { userId, profile: PROFILE });
		issueForPayment(deps, {
			paymentId: 'pay_real',
			userId,
			simulated: false,
			kind: 'full',
			amountEurCents: 1000,
			issueKey: 'payment:pay_real:initial'
		});

		const result = accountingExport(deps, {
			payments: [fact('pay_real', userId, false), fact('pay_sim', userId, true)],
			aiCosts: [
				{
					date: '2026-10-11',
					provider: 'openrouter',
					app: 'secretario',
					usdMicro: 1_250_000,
					eurCents: 115
				}
			]
		});

		expect(result.salesCsv.startsWith('﻿')).toBe(true);
		expect(result.salesCsv).toContain('12345678Z;');
		expect(result.salesCsv).toContain(';000001;');
		expect(result.salesCsv).not.toContain('ref_pay_sim');
		expect(result.monthlyCsv).toContain('2026-10;1;8,26;1,74;10;0;0');
		expect(result.aiCostsCsv).toContain('2026-10-11;openrouter;secretario;1,25;1,15');
		expect(eventsNamed(f.logger, 'invoicing.export.generated')).toHaveLength(1);
	});
});
