// _Seed_ de `apps` contra SQLite real (T082, T080): idempotente, no pisa lo que el administrador cambió, y deja la app
// `secretario` con su perfil, sus operaciones inactivas y los modelos aprobados (T079).
import { afterEach, describe, expect, it } from 'vitest';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { appsTestContext, fixedClock } from '../../../../../tests/builders/apps';
import { seedDefaults } from '$lib/server/seed';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { apps, appOperations, settings } from './schema';
import { updateSetting } from './index';
import { packs } from '../payments/schema';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';

let database: TestDatabase | undefined;

afterEach(() => {
	database?.dispose();
	database = undefined;
});

function counts(db: TestDatabase['db']) {
	return {
		settings: db.select().from(settings).all().length,
		apps: db.select().from(apps).all().length,
		operations: db.select().from(appOperations).all().length,
		packs: db.select().from(packs).all().length
	};
}

describe('datos iniciales', () => {
	it('dos ejecuciones dejan el mismo resultado: ni filas nuevas ni duplicadas', () => {
		database = copyOfTemplate();
		const first = counts(database.db);
		seedDefaults(database.db, fixedClock(), createIdGenerator(seededRandomBytes(5)));

		expect(counts(database.db)).toEqual(first);
		expect(first).toEqual({ settings: 42, apps: 1, operations: 11, packs: 3 });
	});

	it('no sobrescribe un parámetro que el administrador ya cambió', () => {
		database = copyOfTemplate();
		const ctx = appsTestContext(database.db);
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_text_chars',
			value: 150_000,
			reason: 'Ajuste de prueba'
		});

		seedDefaults(database.db, fixedClock(), createIdGenerator(seededRandomBytes(5)));

		const row = database.db
			.select()
			.from(settings)
			.all()
			.find((s) => s.key === 'max_text_chars');
		expect(row?.value).toBe(150_000);
	});

	it('siembra secretario con su perfil, sus once operaciones inactivas y los modelos aprobados (T079)', () => {
		database = copyOfTemplate();
		const app = database.db
			.select()
			.from(apps)
			.all()
			.find((a) => a.id === SEEDED_APP_ID);
		const operations = database.db.select().from(appOperations).all();
		const byKey = (key: string) => operations.find((operation) => operation.key === key);

		expect(app).toMatchObject({
			slug: 'secretario',
			minAppVersion: '4.0.0',
			recommendedAppVersion: '4.0.0',
			enforceVersion: true,
			status: 'active'
		});
		expect(operations).toHaveLength(11);
		expect(operations.every((operation) => !operation.active)).toBe(true);
		expect(byKey('improve')).toMatchObject({
			model: 'anthropic/claude-haiku-5.5',
			fallbackModels: ['openai/gpt-5.6-luna'],
			maxOutputTokens: 8_192,
			maxCostMicro: 12_000_000
		});
		expect(byKey('direct-prompt')).toMatchObject({
			model: 'openai/gpt-5.6-sol',
			fallbackModels: ['anthropic/claude-sonnet-5.5'],
			maxCostMicro: 100_000_000
		});
		expect(byKey('image-generation')).toMatchObject({
			model: 'google/gemini-3.1-flash-image',
			estimatedMaxCostMicroUsd: 80_000,
			maxCostMicro: 80_000_000
		});
	});

	it('la transcripción sembrada tiene primario Voxtral y respaldo aprobado (T079)', () => {
		database = copyOfTemplate();
		const transcription = database.db
			.select()
			.from(appOperations)
			.all()
			.find((operation) => operation.key === 'transcription');

		expect(transcription?.transcriptionConfig).toEqual({
			primary: {
				enabled: true,
				model: 'voxtral-mini-latest',
				timeout_ms: 45_000,
				retry_delays_ms: [2000, 4000, 8000]
			},
			backup: {
				model: 'google/gemini-3.7-flash',
				timeout_ms: 60_000
			}
		});
	});
});
