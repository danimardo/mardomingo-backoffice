// A-02 · El tipo de cambio manual no tiene rango ni validación de tipo (BE-FR-61 CA2: el panel valida «tipos, rangos y
// coherencias»; BE-FR-87 CA3). `/admin/economia?/fijarTipoCambioManual` pasa `Number(form.usdEurPpm)` a `setManualFx`, que no
// lo valida: (1) un valor positivo absurdo, como 920 (0,00092 €/USD, tecleado en vez de 920000), se guarda y desde ese instante
// cada operación se cobra ~1000 veces menos (`pricing/domain/charge.ts` usa este tipo); (2) un decimal («0.92»), NaN o
// negativo lanza `InvalidAmountError` de `toPpm` y un 0 viola el CHECK `fx_rates_usd_eur_positive`: ninguno es `AppError`, así
// que la acción responde 500 en lugar de 400 con el error en el campo.
//
// Destino en el repo: src/lib/server/features/pricing/fx-manual-range.int.test.ts
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/pricing/fx-manual-range.int.test.ts
// Debe FALLAR hoy: el primer `it` (920 se acepta) y los del segundo bloque (lanza un error que no es VALIDATION_ERROR).
// El rango concreto es decisión del propietario; aquí se usa el propuesto en el informe (500 000–2 000 000 ppm).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import { createFakeFxSource } from '$lib/server/adapters/ecb/fake';
import { createIdGenerator } from '$lib/server/shared/ids';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { fxRates } from './schema';
import { clearManualFx, getCurrentFxRate, setManualFx, type PricingDeps } from './service';

let fixture: CreditsFixture;
let deps: PricingDeps;
let adminId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 10, 8, 0, 0));
	const ids = createIdGenerator(seededRandomBytes(71));
	adminId = fixture.addUser('usr_admin_a02', 'admin');
	deps = {
		db: fixture.db,
		logger: fixture.logger,
		clock: fixture.clock,
		ids,
		apps: { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids },
		audit: { clock: fixture.clock, ids, logger: fixture.logger },
		alerts: {
			db: fixture.db,
			logger: fixture.logger,
			clock: fixture.clock,
			sender: createFakeEmailSender(),
			adminEmail: () => 'admin@mardomingo.test',
			supportEmail: () => 'soporte@mardomingo.com'
		},
		fxSource: createFakeFxSource()
	};
});

afterEach(() => {
	fixture.close();
});

describe('A-02 · tipo de cambio manual fuera de rango (BE-FR-61 CA2, BE-FR-87 CA3)', () => {
	it('un tipo de 920 ppm (0,00092 €/USD) se rechaza y no sustituye al vigente', () => {
		const before = getCurrentFxRate(deps);

		expect(() => setManualFx(deps, { adminId, usdEurPpm: 920, reason: 'Error de tecleo' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);

		expect(getCurrentFxRate(deps)).toEqual(before);
		expect(fixture.db.select().from(fxRates).all()).toEqual([]);
	});

	it('un motivo de más de 500 caracteres no fija ni quita el tipo manual (C-55)', () => {
		const before = getCurrentFxRate(deps);

		expect(() =>
			setManualFx(deps, { adminId, usdEurPpm: 920_000, reason: 'x'.repeat(501) })
		).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field: 'reason' } }));
		expect(() => clearManualFx(deps, { adminId, reason: 'x'.repeat(501) })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field: 'reason' } })
		);

		expect(getCurrentFxRate(deps)).toEqual(before);
		expect(fixture.db.select().from(fxRates).all()).toEqual([]);
	});

	it('un tipo de 50 €/USD (50 000 000 ppm) también se rechaza', () => {
		expect(() =>
			setManualFx(deps, { adminId, usdEurPpm: 50_000_000, reason: 'Error de tecleo' })
		).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
	});
});

describe('A-02 · un valor que no es un entero positivo es un error de validación, no un 500', () => {
	it.each([
		['decimal', 0.92],
		['NaN (campo vacío o texto)', Number.NaN],
		['cero', 0],
		['negativo', -920_000]
	])('%s → VALIDATION_ERROR sin escribir', (_name, value) => {
		expect(() => setManualFx(deps, { adminId, usdEurPpm: value, reason: 'Prueba' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
		expect(fixture.db.select().from(fxRates).all()).toEqual([]);
	});
});
