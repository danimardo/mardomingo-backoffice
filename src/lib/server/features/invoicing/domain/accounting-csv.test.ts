// Filas de la exportación contable (BE-FR-76; T240). Puras: los hechos de pago y de coste de IA llegan por parámetro. Las
// compras simuladas no son ingresos y no aparecen en el resumen mensual (BE-FR-25 CA3).
import { describe, expect, it } from 'vitest';
import {
	aiCostRows,
	monthlySummaryRows,
	saleRows,
	type AiCostFact,
	type SaleFact
} from './accounting-csv';

const SALE: SaleFact = {
	invoiceNumber: null,
	taxId: null,
	paymentId: 'pay_1',
	userId: 'usr_1',
	date: '2026-10-11',
	country: 'ES',
	baseEurCents: 826,
	vatEurCents: 174,
	totalEurCents: 1000,
	refundedEurCents: 0,
	chargebackEurCents: 0,
	simulated: false,
	providerRef: 'sim_pay_1'
};

const FISCAL = { invoiceNumber: '000001', taxId: '12345678Z' };

describe('saleRows', () => {
	it('escribe la venta con sus datos fiscales, IVA y número de factura', () => {
		expect(saleRows([{ ...SALE, ...FISCAL }])).toEqual([
			['2026-10-11', 'usr_1', '12345678Z', 'ES', 8.26, 1.74, 10, '000001', 'sim_pay_1', 0, 0]
		]);
	});

	it('deja vacíos los datos fiscales y la factura cuando no existen', () => {
		expect(saleRows([{ ...SALE, invoiceNumber: null, taxId: null }])[0]).toEqual([
			'2026-10-11',
			'usr_1',
			'',
			'ES',
			8.26,
			1.74,
			10,
			'',
			'sim_pay_1',
			0,
			0
		]);
	});

	it('sin referencia de proveedor, la celda queda vacía', () => {
		expect(saleRows([{ ...SALE, providerRef: null }])[0]?.[8]).toBe('');
	});

	it('excluye las compras simuladas: no son ingresos', () => {
		expect(saleRows([{ ...SALE, simulated: true, invoiceNumber: null, taxId: null }])).toEqual([]);
	});
});

describe('monthlySummaryRows', () => {
	it('agrupa por mes y suma base, cuota, total, reembolsos y contracargos', () => {
		const sales: SaleFact[] = [
			{ ...SALE, date: '2026-10-02', ...FISCAL },
			{
				...SALE,
				paymentId: 'pay_2',
				date: '2026-10-20',
				refundedEurCents: 500,
				totalEurCents: 1000
			},
			{ ...SALE, paymentId: 'pay_3', date: '2026-11-01', chargebackEurCents: 1000 }
		];

		expect(monthlySummaryRows(sales)).toEqual([
			['2026-10', 2, 16.52, 3.48, 20, 5, 0],
			['2026-11', 1, 8.26, 1.74, 10, 0, 10]
		]);
	});

	it('no cuenta las compras simuladas en el resumen', () => {
		expect(monthlySummaryRows([{ ...SALE, simulated: true }])).toEqual([]);
	});
});

describe('aiCostRows', () => {
	it('escribe el coste por proveedor, día y app en USD y EUR', () => {
		const costs: AiCostFact[] = [
			{
				date: '2026-10-11',
				provider: 'openrouter',
				app: 'secretario',
				usdMicro: 1_250_000,
				eurCents: 115
			}
		];

		expect(aiCostRows(costs)).toEqual([['2026-10-11', 'openrouter', 'secretario', 1.25, 1.15]]);
	});
});
