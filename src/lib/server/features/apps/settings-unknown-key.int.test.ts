// C-60 (T451; BE-FR-61 CA5): una clave de `settings` que esta imagen no conoce (la sembró una imagen posterior antes de
// volver atrás) no impide leer los parámetros: se omite y se avisa una vez por clave y conexión, sin el valor. Una clave
// conocida con un valor que no encaja sigue siendo corrupción. Contra SQLite real con los parámetros sembrados.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { appsTestContext, type AppsTestContext } from '../../../../../tests/builders/apps';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '../audit/schema';
import { getEffectiveConfig, getSetting, updateSetting } from './index';
import { readSettings } from './repository';

const FUTURE_KEY = 'zzz_future_key';
const FUTURE_VALUE = 'valor-que-no-debe-salir';

let database: TestDatabase | undefined;
let ctx: AppsTestContext;

beforeEach(() => {
	database = copyOfTemplate();
	ctx = appsTestContext(database.db);
});

afterEach(() => {
	database?.dispose();
	database = undefined;
});

function sql(query: string): void {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	database.sqlite.exec(query);
}

function insertSetting(key: string, jsonValue: string): void {
	sql(`INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${jsonValue}', 1000)`);
}

function codeOf(action: () => unknown): ErrorCode | undefined {
	try {
		action();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error.code : undefined;
	}
}

describe('clave de `settings` desconocida (C-60)', () => {
	it('no impide leer los parámetros: se omite y se avisa sin el valor', () => {
		insertSetting(FUTURE_KEY, JSON.stringify(FUTURE_VALUE));

		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			200_000
		);
		expect(getSetting(ctx.deps, 'max_debt')).toBe(200_000_000);
		expect([...readSettings(ctx.deps.db, ctx.logger).keys()]).not.toContain(FUTURE_KEY);
		expect(eventsNamed(ctx.logger, 'apps.config.corrupt')).toHaveLength(0);

		const warnings = eventsNamed(ctx.logger, 'apps.settings.unknown_key');
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({ level: 'warn', fields: { key: FUTURE_KEY } });
		expect(warnings[0]?.fields).toEqual({ key: FUTURE_KEY });
		expect(JSON.stringify(ctx.logger.events)).not.toContain(FUTURE_VALUE);
	});

	it('avisa una sola vez por clave y conexión, aunque se vuelva a leer de la BD', () => {
		insertSetting(FUTURE_KEY, '1');
		insertSetting('zzz_other_future_key', '2');

		readSettings(ctx.deps.db, ctx.logger);
		readSettings(ctx.deps.db, ctx.logger);
		// Cambiar un parámetro invalida la caché: la lectura siguiente vuelve a la BD.
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_text_chars',
			value: 150_000,
			reason: 'Ajuste de prueba'
		});
		expect(getSetting(ctx.deps, 'max_text_chars')).toBe(150_000);

		expect(eventsNamed(ctx.logger, 'apps.settings.unknown_key').map((e) => e.fields)).toEqual(
			expect.arrayContaining([{ key: FUTURE_KEY }, { key: 'zzz_other_future_key' }])
		);
		expect(eventsNamed(ctx.logger, 'apps.settings.unknown_key')).toHaveLength(2);
	});

	it('el panel sigue sin aceptar guardar la clave desconocida, y la fila no cambia', () => {
		insertSetting(FUTURE_KEY, '1');

		expect(
			codeOf(() =>
				updateSetting(ctx.deps, {
					actorId: ctx.adminId,
					key: FUTURE_KEY,
					value: 2,
					reason: 'Prueba'
				})
			)
		).toBe('VALIDATION_ERROR');
		expect(ctx.deps.db.select().from(adminAudit).all()).toHaveLength(0);
		expect(
			database?.sqlite
				.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
				.get(FUTURE_KEY)
		).toEqual({ value: '1' });
	});
});

describe('clave de `settings` conocida con un valor no válido (BE-FR-61 CA5)', () => {
	it('sigue siendo corrupción: la lectura falla, se registra y el dato no cambia', () => {
		sql(`UPDATE settings SET value = '"mucho"' WHERE key = 'max_debt'`);

		expect(codeOf(() => getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }))).toBe(
			'INTERNAL_ERROR'
		);
		expect(eventsNamed(ctx.logger, 'apps.config.corrupt')[0]?.fields).toEqual({
			table: 'settings',
			field: 'max_debt'
		});
		expect(eventsNamed(ctx.logger, 'apps.settings.unknown_key')).toHaveLength(0);
		expect(
			database?.sqlite
				.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
				.get('max_debt')
		).toEqual({ value: '"mucho"' });
	});
});
