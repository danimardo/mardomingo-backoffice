// Anuncios y estado de la app contra SQLite real (BE-FR-85 CA1–CA2, BE-FR-84, BE-FR-48 CA2, BE-FR-77 CA4; T194). Se
// siembran anuncios directamente (el CRUD del administrador es de L13) y se comprueba la visibilidad, el mantenimiento global
// con prioridad, los tiempos y los enlaces de `/app/status`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { announcementsFor, appStatusOf } from './service';
import { announcements } from './schema';
import { toEpochMs } from '$lib/shared/time';
import { createFakeLogger } from '../../../../../tests/builders/fake-logger';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { createSystemClock } from '$lib/server/adapters/clock/clock';
import { settings } from './schema';
import { appOperations } from './schema';
import { eq } from 'drizzle-orm';
import type { AppsDeps } from './service';

const NOW = 1_800_000_000_000;
const WEB = 'https://cuenta.mardomingo.com';

let database: TestDatabase;
let deps: AppsDeps;

beforeEach(() => {
	database = copyOfTemplate();
	const logger = createFakeLogger();
	const clock = createSystemClock();
	deps = { db: database.db, logger, clock, ids: createIdGenerator(seededRandomBytes(61)) };
});

afterEach(() => {
	database.dispose();
});

function announce(overrides: Partial<typeof announcements.$inferInsert> & { id: string }) {
	database.db
		.insert(announcements)
		.values({
			level: 'info',
			message: 'Aviso',
			startsAt: toEpochMs(NOW - 1_000),
			active: true,
			...overrides
		})
		.run();
}

describe('announcementsFor', () => {
	it('muestra solo los anuncios activos, vigentes y del rango de la versión', () => {
		announce({ id: 'ann_global', message: 'Para todas' });
		announce({
			id: 'ann_app',
			appId: SEEDED_APP_ID,
			level: 'warning',
			message: 'Para secretario',
			minVersion: '4.0.0',
			maxVersion: '4.2.0'
		});
		announce({ id: 'ann_apagado', active: false, message: 'Inactivo' });
		announce({ id: 'ann_caducado', endsAt: toEpochMs(NOW - 1), message: 'Caducado' });
		announce({ id: 'ann_futuro', startsAt: toEpochMs(NOW + 60_000), message: 'Aún no' });

		const visible = announcementsFor(deps, { appId: SEEDED_APP_ID, version: '4.1.0', now: NOW });

		expect(visible.map((item) => item.id).sort()).toEqual(['ann_app', 'ann_global']);
		expect(visible.find((item) => item.id === 'ann_app')).toMatchObject({
			level: 'warning',
			endsAt: null
		});
	});

	it('sin versión, no muestra los anuncios con rango de versiones', () => {
		announce({ id: 'ann_rango', minVersion: '4.0.0' });
		announce({ id: 'ann_sin_rango' });

		expect(
			announcementsFor(deps, { appId: SEEDED_APP_ID, version: null, now: NOW }).map((i) => i.id)
		).toEqual(['ann_sin_rango']);
	});

	it('el fin de un anuncio se devuelve como ISO', () => {
		announce({ id: 'ann_con_fin', endsAt: toEpochMs(NOW + 3_600_000) });

		expect(
			announcementsFor(deps, { appId: SEEDED_APP_ID, version: '4.0.0', now: NOW })[0]?.endsAt
		).toBe(new Date(NOW + 3_600_000).toISOString());
	});
});

describe('restricciones de announcements', () => {
	it('el fin debe ser posterior al inicio (CHECK ends_at > starts_at)', () => {
		expect(() => {
			announce({
				id: 'ann_ventana_invertida',
				startsAt: toEpochMs(NOW),
				endsAt: toEpochMs(NOW - 1)
			});
		}).toThrow();
	});

	it('el nivel debe ser info, warning o critical', () => {
		expect(() =>
			database.sqlite
				.prepare(
					'INSERT INTO announcements (id, level, message, starts_at, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
				)
				.run('ann_nivel', 'urgente', 'x', NOW, NOW, NOW)
		).toThrow();
	});
});

describe('appStatusOf', () => {
	it('devuelve versiones, límites, tiempo total de la transcripción, enlaces y soporte', () => {
		// Solo se listan las operaciones activas; la transcripción se siembra inactiva (la activa el administrador, L13).
		database.db
			.update(appOperations)
			.set({ active: true })
			.where(eq(appOperations.key, 'transcription'))
			.run();
		const status = appStatusOf(deps, {
			appId: SEEDED_APP_ID,
			version: '4.0.0',
			now: NOW,
			webBaseUrl: WEB
		});

		expect(status).toMatchObject({
			app: { id: 'secretario' },
			minAppVersion: '4.0.0',
			maintenance: { active: false, message: '' },
			limits: { maxAudioSeconds: 300 },
			operations: { transcription: { timeoutMs: 254_000 } },
			links: {
				register: `${WEB}/registro?app=secretario`,
				forgotPassword: `${WEB}/recuperar`,
				acceptableUse: `${WEB}/uso-aceptable`
			}
		});
		expect(status?.supportEmail).toContain('@');
	});

	it('el mantenimiento global tiene prioridad sobre el de la app y lleva su mensaje', () => {
		database.db
			.update(settings)
			.set({ value: { active: true, message: 'Mantenimiento global' } })
			.where(eq(settings.key, 'maintenance'))
			.run();

		expect(
			appStatusOf(deps, { appId: SEEDED_APP_ID, version: '4.0.0', now: NOW, webBaseUrl: WEB })
				?.maintenance
		).toEqual({
			active: true,
			message: 'Mantenimiento global'
		});
	});

	it('una app inexistente no tiene estado', () => {
		expect(
			appStatusOf(deps, { appId: 'app_no_existe', version: null, now: NOW, webBaseUrl: WEB })
		).toBeUndefined();
	});
});
