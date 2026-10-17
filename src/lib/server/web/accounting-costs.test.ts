// Coste de IA en euros para el informe contable (BE-FR-76; T316): fórmula micro-USD × ppm / 10¹⁰, agrupación por día, proveedor y app,
// y recuento de operaciones sin tipo conocido (no se inventa un tipo).
import { describe, expect, it } from 'vitest';
import { aiCostsInEur, eurCentsOf } from './accounting-costs';

const RATE = 920_000;
const rates = (id: string): number | null => (id === 'fx_1' ? RATE : null);

describe('coste de IA en euros', () => {
	it('un dólar a 0,92 son 92 céntimos', () => {
		expect(eurCentsOf(1_000_000, RATE)).toBe(92);
	});

	it('agrupa por día, proveedor y app y convierte cada operación con su tipo', () => {
		const result = aiCostsInEur(
			[
				{
					date: '2026-10-17',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 1_000_000,
					fxRateId: 'fx_1'
				},
				{
					date: '2026-10-17',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 2_000_000,
					fxRateId: 'fx_1'
				},
				{
					date: '2026-10-18',
					provider: 'mistral',
					appId: 'app_a',
					usdMicro: 500_000,
					fxRateId: 'fx_1'
				}
			],
			rates
		);

		expect(result.unconverted).toBe(0);
		expect(result.costs).toEqual([
			{
				date: '2026-10-17',
				provider: 'openrouter',
				app: 'app_a',
				usdMicro: 3_000_000,
				eurCents: 276
			},
			{ date: '2026-10-18', provider: 'mistral', app: 'app_a', usdMicro: 500_000, eurCents: 46 }
		]);
	});

	it('una operación sin tipo conocido cuenta como sin convertir y no suma euros', () => {
		const result = aiCostsInEur(
			[
				{
					date: '2026-10-17',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 1_000_000,
					fxRateId: null
				},
				{
					date: '2026-10-17',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 1_000_000,
					fxRateId: 'fx_otro'
				}
			],
			rates
		);

		expect(result.unconverted).toBe(2);
		expect(result.costs[0]).toMatchObject({ usdMicro: 2_000_000, eurCents: 0 });
	});
});
