// Presentación de los precios orientativos (T346; BE-FR-73; contracts/web-routes.md W03). Claves exactas con
// `toStrictEqual`: la página no puede dejar escapar el modelo ni el coste real, solo créditos y el origen del valor.
import { describe, expect, it } from 'vitest';
import { toCivilDate } from '$lib/shared/time';
import { hoursPerPackTenths, pricePageOf } from './presenters';

const CREDIT = 1_000_000;

describe('pricePageOf (W03)', () => {
	it('agrupa por app, conserva el orden recibido y publica solo créditos y origen', () => {
		const page = pricePageOf({
			operations: [
				{ appName: 'Secretario AI', name: 'Dictado', typicalMicro: 1_800_000, source: 'auto' },
				{ appName: 'Secretario AI', name: 'Redactar', typicalMicro: 5 * CREDIT, source: 'manual' },
				{ appName: 'Otra', name: 'Imagen', typicalMicro: null, source: null }
			],
			dictationMinuteMicro: 1_800_000,
			packCreditsMicro: 5_000 * CREDIT,
			computedAt: Date.UTC(2026, 9, 18, 3, 0, 0)
		});

		expect(page).toStrictEqual({
			groups: [
				{
					appName: 'Secretario AI',
					operations: [
						{ name: 'Dictado', typicalMicro: 1_800_000, source: 'auto' },
						{ name: 'Redactar', typicalMicro: 5 * CREDIT, source: 'manual' }
					]
				},
				{
					appName: 'Otra',
					operations: [{ name: 'Imagen', typicalMicro: null, source: null }]
				}
			],
			examples: { dictationMinuteMicro: 1_800_000, hoursPerPack5EurTenths: 462 },
			computedOn: toCivilDate('2026-10-18')
		});
	});

	it('sin ninguna operación con precio, sin ejemplos ni fecha de cálculo', () => {
		const page = pricePageOf({
			operations: [],
			dictationMinuteMicro: null,
			packCreditsMicro: 5_000 * CREDIT,
			computedAt: null
		});
		expect(page).toStrictEqual({
			groups: [],
			examples: { dictationMinuteMicro: null, hoursPerPack5EurTenths: null },
			computedOn: null
		});
	});

	it('la fecha de cálculo es el día de Madrid del instante más reciente', () => {
		// 2026-10-18 22:30 UTC ya es el 19 en Madrid (UTC+2).
		const page = pricePageOf({
			operations: [],
			dictationMinuteMicro: null,
			packCreditsMicro: 0,
			computedAt: Date.UTC(2026, 9, 18, 22, 30)
		});
		expect(page.computedOn).toBe(toCivilDate('2026-10-19'));
	});
});

describe('hoursPerPackTenths', () => {
	it('décimas de hora de dictado que caben en un paquete, redondeando hacia abajo', () => {
		// 5.000 créditos a 1,8 créditos por minuto: 2.777,7 minutos = 46,29 horas.
		expect(hoursPerPackTenths({ packCreditsMicro: 5_000 * CREDIT, minuteMicro: 1_800_000 })).toBe(
			462
		);
		expect(hoursPerPackTenths({ packCreditsMicro: 60 * CREDIT, minuteMicro: CREDIT })).toBe(10);
	});

	it('sin precio por minuto o con un minuto gratis, no hay ejemplo', () => {
		expect(hoursPerPackTenths({ packCreditsMicro: CREDIT, minuteMicro: 0 })).toBeNull();
		expect(hoursPerPackTenths({ packCreditsMicro: CREDIT, minuteMicro: null })).toBeNull();
	});
});
