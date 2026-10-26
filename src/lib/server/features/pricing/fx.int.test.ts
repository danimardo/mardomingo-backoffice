// Tipo de cambio contra SQLite real y el simulador del BCE (T153; BE-FR-87 CA1–CA3, BE-FR-19–22): restricciones de
// `fx_rates`, adaptador del BCE (éxito, fin de semana, CSV inválido, caída, observación atrasada), alerta tras varios días
// sin actualizar y su rearme, valor manual auditado y su desactivación, y vigencia en el instante del cobro.
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createEcbFxSource } from '$lib/server/adapters/ecb/ecb-fx-source';
import { createFakeFxSource, type FakeFxSource } from '$lib/server/adapters/ecb/fake';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { adminAudit } from '$lib/server/features/audit/schema';
import { alertsState } from '$lib/server/features/notifications/schema';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { startEcbMock } from '../../../../../tests/mock-servers/ecb';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { fxRates } from './schema';
import { toPpm } from '$lib/shared/money';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import {
	clearManualFx,
	getCurrentFxRate,
	refreshFxFromEcb,
	setManualFx,
	type PricingDeps
} from './service';
import { fxUsdEurPpm } from './domain/fx';

const DAY = 24 * 60 * 60 * 1000;
const SATURDAY = Date.UTC(2026, 9, 10, 8, 0, 0);
const WEDNESDAY = Date.UTC(2026, 9, 14, 8, 0, 0);
const BUFFER = 30_000;

let fixture: CreditsFixture;
let sender: FakeEmailSender;
let fake: FakeFxSource;
let deps: PricingDeps;
let adminId: string;

beforeEach(() => {
	fixture = creditsFixture(SATURDAY);
	sender = createFakeEmailSender();
	fake = createFakeFxSource();
	const ids = createIdGenerator(seededRandomBytes(53));
	adminId = fixture.addUser('usr_admin', 'admin');
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
			sender,
			adminEmail: () => 'admin@mardomingo.test',
			supportEmail: () => 'soporte@mardomingo.com'
		},
		fxSource: fake
	};
});

afterEach(() => {
	fixture.close();
});

function rows() {
	return fixture.db.select().from(fxRates).all();
}

describe('restricciones de fx_rates (data-model 2.5)', () => {
	it('un tipo no positivo no entra', () => {
		expect(() =>
			fixture.db
				.insert(fxRates)
				.values({
					id: 'fx_bad',
					usdEurPpm: toPpm(0),
					source: 'manual',
					effectiveFrom: toEpochMs(SATURDAY),
					createdBy: adminId
				})
				.run()
		).toThrow();
	});

	it('una fila del BCE sin sus campos no entra', () => {
		expect(() =>
			fixture.db
				.insert(fxRates)
				.values({
					id: 'fx_ecb_incompleta',
					usdEurPpm: toPpm(920_000),
					source: 'ecb',
					effectiveFrom: toEpochMs(SATURDAY)
				})
				.run()
		).toThrow();
	});

	it('un valor manual sin autor no entra', () => {
		expect(() =>
			fixture.db
				.insert(fxRates)
				.values({
					id: 'fx_manual_anonimo',
					usdEurPpm: toPpm(920_000),
					source: 'manual',
					effectiveFrom: toEpochMs(SATURDAY)
				})
				.run()
		).toThrow();
	});
});

describe('adaptador del BCE contra el simulador (BE-FR-87 CA2)', () => {
	let mock: MockServer;

	beforeAll(async () => {
		mock = await startEcbMock();
	});

	afterAll(async () => {
		await mock.close();
	});

	it('[BE-FR-87/CA1] una observación actual se guarda con su fecha, su origen y el colchón', async () => {
		fixture.clock.set(Date.UTC(2026, 9, 10, 8, 0, 0));
		deps = { ...deps, fxSource: createEcbFxSource({ endpoint: mock.url }) };

		const outcome = await refreshFxFromEcb(deps);

		expect(outcome).toEqual({
			status: 'updated',
			usdEurPpm: fxUsdEurPpm({ bceRatePpm: 1_087_000, bufferPpm: toPpm(BUFFER) })
		});
		expect(rows().at(-1)).toMatchObject({
			source: 'ecb',
			ecbDate: toCivilDate('2026-10-09'),
			ecbRatePpm: toPpm(1_087_000),
			bufferPpm: toPpm(BUFFER)
		});
		expect(mock.requests.at(-1)?.path).toBe('/service/data/EXR/D.USD.EUR.SP00.A');
	});

	it('una respuesta vacía (fin de semana o festivo) no cambia nada y no es un fallo', async () => {
		mock.scenario('empty');
		deps = { ...deps, fxSource: createEcbFxSource({ endpoint: mock.url }) };
		const before = rows().length;

		expect(await refreshFxFromEcb(deps)).toEqual({ status: 'no_publication' });
		expect(rows()).toHaveLength(before);
		mock.scenario('ok');
	});

	it('[BE-FR-87/CA2] un CSV que no encaja es un fallo de contenido, y se mantiene el último valor', async () => {
		fixture.clock.set(Date.UTC(2026, 9, 10, 8, 0, 0));
		deps = { ...deps, fxSource: createEcbFxSource({ endpoint: mock.url }) };
		await refreshFxFromEcb(deps);
		const kept = getCurrentFxRate(deps).usdEurPpm;

		mock.scenario('invalid');
		expect(await refreshFxFromEcb(deps)).toEqual({ status: 'failed', reason: 'invalid' });
		expect(getCurrentFxRate(deps)).toMatchObject({ usdEurPpm: kept, source: 'ecb' });
		mock.scenario('ok');
	});

	it('una caída del servicio es un fallo no disponible', async () => {
		mock.scenario('down');
		deps = { ...deps, fxSource: createEcbFxSource({ endpoint: mock.url }) };

		expect(await refreshFxFromEcb(deps)).toEqual({ status: 'failed', reason: 'unavailable' });
		mock.scenario('ok');
	});

	it('una observación antigua cuenta como fallo aunque llegue con 200', async () => {
		mock.scenario('stale');
		deps = { ...deps, fxSource: createEcbFxSource({ endpoint: mock.url }) };

		expect(await refreshFxFromEcb(deps)).toEqual({ status: 'failed', reason: 'stale_observation' });
		mock.scenario('ok');
	});
});

describe('alerta por tipo de cambio sin actualizar (BE-FR-87 CA2, SC-019)', () => {
	it('[BE-FR-87/CA2] tras tres días laborables sin actualizar avisa una vez, y se rearma al volver a actualizar', async () => {
		// Primera actualización el viernes 9 de octubre.
		fake.next({ status: 'observation', timePeriod: '2026-10-09', rate: '1.0870' });
		fixture.clock.set(Date.UTC(2026, 9, 9, 17, 0, 0));
		await refreshFxFromEcb(deps);

		// Luego, caídas el lunes, martes y miércoles: tres laborables sin publicar.
		fake.next({ status: 'error', reason: 'unavailable' });
		fixture.clock.set(Date.UTC(2026, 9, 12, 8, 0, 0));
		await refreshFxFromEcb(deps);
		fixture.clock.set(Date.UTC(2026, 9, 13, 8, 0, 0));
		await refreshFxFromEcb(deps);
		fixture.clock.set(WEDNESDAY);
		await refreshFxFromEcb(deps);

		expect(sender.sent).toHaveLength(1);
		expect(
			fixture.db.select().from(alertsState).where(eq(alertsState.key, 'fx_stale')).get()?.active
		).toBe(true);

		// El mismo día, otro fallo no repite el aviso.
		await refreshFxFromEcb(deps);
		expect(sender.sent).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'notifications.alert.suppressed')).toHaveLength(1);

		// Vuelve la publicación: la alerta se rearma sin email.
		fake.next({ status: 'observation', timePeriod: '2026-10-14', rate: '1.0870' });
		await refreshFxFromEcb(deps);
		expect(
			fixture.db.select().from(alertsState).where(eq(alertsState.key, 'fx_stale')).get()?.active
		).toBe(false);
		expect(sender.sent).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'notifications.alert.rearmed')).toHaveLength(1);
	});
});

describe('valor manual auditado (BE-FR-87 CA3)', () => {
	it('[BE-FR-87/CA3] fijar un valor manual lo sustituye, queda en la auditoría con antes y después, y desactivarlo vuelve al BCE', async () => {
		fake.next({ status: 'observation', timePeriod: '2026-10-09', rate: '1.0870' });
		fixture.clock.set(Date.UTC(2026, 9, 9, 17, 0, 0));
		await refreshFxFromEcb(deps);
		fixture.clock.set(SATURDAY);

		setManualFx(deps, { adminId, usdEurPpm: toPpm(950_000), reason: 'Tipo de la gestoría' });
		expect(getCurrentFxRate(deps)).toMatchObject({ usdEurPpm: toPpm(950_000), source: 'manual' });

		const audit = fixture.db
			.select()
			.from(adminAudit)
			.where(eq(adminAudit.action, 'pricing.fx.manual_set'))
			.all();
		expect(audit).toHaveLength(1);
		expect(audit[0]?.reason).toBe('Tipo de la gestoría');

		// Desactivar ocurre después: con el reloj falso en el mismo milisegundo, las dos filas empatarían en `effective_from`.
		fixture.clock.advance(1_000);
		expect(clearManualFx(deps, { adminId, reason: 'Vuelta al BCE' })).toEqual({ ok: true });
		expect(getCurrentFxRate(deps).source).toBe('ecb');
		expect(
			fixture.db
				.select()
				.from(adminAudit)
				.where(eq(adminAudit.action, 'pricing.fx.manual_cleared'))
				.all()
		).toHaveLength(1);
	});
});

describe('el refresco automático respeta el valor manual (BE-FR-87 CA3)', () => {
	it('un refresco con el manual vigente no lo sustituye, y al desactivarlo se vuelve al último valor del BCE', async () => {
		fake.next({ status: 'observation', timePeriod: '2026-10-09', rate: '1.0870' });
		fixture.clock.set(Date.UTC(2026, 9, 9, 17, 0, 0));
		await refreshFxFromEcb(deps);

		fixture.clock.advance(1_000);
		setManualFx(deps, { adminId, usdEurPpm: toPpm(950_000), reason: 'Tipo de la gestoría' });

		fake.next({ status: 'observation', timePeriod: '2026-10-09', rate: '1.1000' });
		fixture.clock.advance(1_000);
		await refreshFxFromEcb(deps);
		expect(getCurrentFxRate(deps)).toMatchObject({ usdEurPpm: toPpm(950_000), source: 'manual' });

		fixture.clock.advance(1_000);
		expect(clearManualFx(deps, { adminId, reason: 'Vuelta al BCE' })).toEqual({ ok: true });
		const expected = fxUsdEurPpm({ bceRatePpm: toPpm(1_100_000), bufferPpm: toPpm(BUFFER) });
		expect(getCurrentFxRate(deps)).toMatchObject({ usdEurPpm: expected, source: 'ecb' });
	});
});

describe('vigencia en el instante del cobro (BE-FR-87 CA1) y valor por defecto', () => {
	it('sin filas, 0,92 (920.000 ppm); después, lo que esté vigente en ese instante', () => {
		expect(getCurrentFxRate(deps)).toMatchObject({ usdEurPpm: toPpm(920_000), source: 'default' });

		const t1 = Date.UTC(2026, 9, 9, 16, 30);
		const t2 = Date.UTC(2026, 9, 12, 16, 30);
		fixture.db
			.insert(fxRates)
			.values([
				{
					id: 'fx_t1',
					usdEurPpm: toPpm(900_000),
					source: 'ecb',
					ecbRatePpm: toPpm(1_087_000),
					ecbDate: toCivilDate('2026-10-09'),
					bufferPpm: toPpm(BUFFER),
					effectiveFrom: toEpochMs(t1)
				},
				{
					id: 'fx_t2',
					usdEurPpm: toPpm(910_000),
					source: 'ecb',
					ecbRatePpm: toPpm(1_087_000),
					ecbDate: toCivilDate('2026-10-12'),
					bufferPpm: toPpm(BUFFER),
					effectiveFrom: toEpochMs(t2)
				}
			])
			.run();

		fixture.clock.set(t1 + DAY / 2);
		expect(getCurrentFxRate(deps).usdEurPpm).toBe(900_000);
		fixture.clock.set(t2 + DAY);
		expect(getCurrentFxRate(deps).usdEurPpm).toBe(910_000);
	});
});
