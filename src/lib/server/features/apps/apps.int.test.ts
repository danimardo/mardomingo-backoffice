// Configuración de `apps` contra SQLite real (T082; BE-FR-61 CA1–CA5, BE-FR-62 CA2–CA3, BE-FR-31). Cubre las
// restricciones de la BD, los cambios auditados, los topes, la configuración efectiva, el JSON corrupto y las plantillas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import {
	addOperation,
	addSecondApp,
	appsTestContext,
	chatOperation,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '../audit/schema';
import { apps, appOperations } from './schema';
import {
	createApp,
	createTemplateVersion,
	getEffectiveConfig,
	updateAppOverrides,
	updateSetting
} from './index';

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

function db(): TestDatabase['db'] {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	return database.db;
}

function raw(query: string): void {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	database.sqlite.exec(query);
}

function rawValue(query: string): unknown {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	return database.sqlite.prepare<[], Record<string, unknown>>(query).get();
}

/** Código de error de aplicación que lanza una función, o `undefined` si no lanza. */
function codeOf(action: () => unknown): ErrorCode | undefined {
	try {
		action();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error.code : undefined;
	}
}

function auditRowsFor(entityId: string): number {
	return db()
		.select()
		.from(adminAudit)
		.all()
		.filter((row) => row.entityId === entityId).length;
}

describe('restricciones de la base de datos (T070, T071, T073)', () => {
	it('un slug con mayúsculas o espacios no entra: el CHECK lo rechaza', () => {
		expect(() => {
			raw(
				`INSERT INTO apps (id, slug, name, client_types, links, sync_schema) VALUES ('app_x', 'Secre taria', 'X', '["web"]', '{"landing":{"type":"internal"}}', '{"categories":{}}')`
			);
		}).toThrow();
	});

	it('un slug repetido se rechaza con SLUG_TAKEN', () => {
		addSecondApp(ctx);

		expect(codeOf(() => addSecondApp(ctx))).toBe('SLUG_TAKEN');
	});

	it('una clave de operación repetida en la misma app se rechaza', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('fix'));

		expect(codeOf(() => addOperation(ctx, appId, chatOperation('fix')))).toBe('VALIDATION_ERROR');
	});

	it('una operación de una app inexistente no entra: la clave foránea lo rechaza', () => {
		expect(() => {
			raw(
				`INSERT INTO app_operations (id, app_id, key, name, kind, max_cost_micro, timeout_ms, capabilities, active) VALUES ('aop_x', 'app_inexistente', 'k', 'K', 'chat', 1, 1, '{"image_input":false,"structured_output":false,"tools":false}', 0)`
			);
		}).toThrow();
	});

	it('un JSON mal formado no entra en ninguna columna: el CHECK lo rechaza', () => {
		expect(() => {
			raw(`UPDATE apps SET links = '{no json' WHERE id = '${SEEDED_APP_ID}'`);
		}).toThrow();
	});

	it('un margen por debajo de 1,0 no entra', () => {
		const appId = addSecondApp(ctx);

		expect(
			codeOf(() =>
				addOperation(ctx, appId, chatOperation('margen', { marginOverridePpm: 999_999 }))
			)
		).toBe('VALIDATION_ERROR');
	});

	it('una operación de chat sin tope de salida no entra', () => {
		const appId = addSecondApp(ctx);

		expect(
			codeOf(() => addOperation(ctx, appId, chatOperation('sin-tope', { maxOutputTokens: null })))
		).toBe('VALIDATION_ERROR');
	});
});

describe('parámetros globales y auditoría (BE-FR-61 CA1, BE-FR-55)', () => {
	it('un cambio válido se guarda, se audita con el valor anterior y el nuevo, y emite su evento', () => {
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_text_chars',
			value: 150_000,
			reason: 'Ajuste de prueba'
		});

		const config = getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID });
		expect(config.settings.max_text_chars).toBe(150_000);
		const [entry] = db().select().from(adminAudit).all();
		expect(entry).toMatchObject({
			adminId: ctx.adminId,
			action: 'apps.setting.update',
			entity: 'setting',
			entityId: 'max_text_chars',
			before: { value: 200_000 },
			after: { value: 150_000 },
			reason: 'Ajuste de prueba'
		});
		expect(eventsNamed(ctx.logger, 'apps.settings.updated')).toHaveLength(1);
	});

	it('un valor fuera de rango se rechaza: no cambia nada, no se audita y se registra el rechazo', () => {
		expect(
			codeOf(() => {
				updateSetting(ctx.deps, {
					actorId: ctx.adminId,
					key: 'min_age',
					value: 0,
					reason: 'Prueba'
				});
			})
		).toBe('VALIDATION_ERROR');

		expect(db().select().from(adminAudit).all()).toHaveLength(0);
		expect(eventsNamed(ctx.logger, 'apps.settings.rejected')[0]?.fields).toMatchObject({
			key: 'min_age',
			reason: 'validation'
		});
		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			200_000
		);
	});

	it('el motivo es obligatorio en cualquier cambio de parámetro', () => {
		expect(
			codeOf(() => {
				updateSetting(ctx.deps, {
					actorId: ctx.adminId,
					key: 'max_text_chars',
					value: 1,
					reason: '  '
				});
			})
		).toBe('VALIDATION_ERROR');
	});

	it('una clave que no existe en §9 no se acepta', () => {
		expect(
			codeOf(() => {
				updateSetting(ctx.deps, {
					actorId: ctx.adminId,
					key: 'clave_inventada',
					value: 1,
					reason: 'x'
				});
			})
		).toBe('VALIDATION_ERROR');
	});

	it('el email de soporte se audita redactado: la auditoría nunca guarda emails', () => {
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'support_email',
			value: 'nuevo@mardomingo.com',
			reason: 'Cambio de contacto'
		});

		const [entry] = db().select().from(adminAudit).all();
		expect(entry?.after).toEqual({ value: '[redactado]' });
	});

	it('la caché de parámetros se invalida al cambiar uno: la lectura siguiente ya ve el valor nuevo', () => {
		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			200_000
		);
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_text_chars',
			value: 120_000,
			reason: 'Prueba de caché'
		});

		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			120_000
		);
	});
});

describe('sobrescrituras y topes (BE-FR-61 CA3, CA4)', () => {
	it('una app puede sobrescribir un valor por debajo del global', () => {
		updateAppOverrides(ctx.deps, {
			actorId: ctx.adminId,
			appId: SEEDED_APP_ID,
			overrides: { ai_requests_per_minute: 20 },
			reason: 'Límite conservador'
		});

		expect(
			getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.ai_requests_per_minute
		).toBe(20);
	});

	it('una sobrescritura por encima del global se rechaza', () => {
		expect(
			codeOf(() => {
				updateAppOverrides(ctx.deps, {
					actorId: ctx.adminId,
					appId: SEEDED_APP_ID,
					overrides: { ai_requests_per_minute: 31 },
					reason: 'Prueba'
				});
			})
		).toBe('VALIDATION_ERROR');
		expect(eventsNamed(ctx.logger, 'apps.settings.rejected')[0]?.fields).toMatchObject({
			reason: 'ceiling'
		});
	});

	it('bajar el global por debajo de una sobrescritura concedida se rechaza', () => {
		updateAppOverrides(ctx.deps, {
			actorId: ctx.adminId,
			appId: SEEDED_APP_ID,
			overrides: { ai_requests_per_minute: 20 },
			reason: 'Límite conservador'
		});

		expect(
			codeOf(() => {
				updateSetting(ctx.deps, {
					actorId: ctx.adminId,
					key: 'ai_requests_per_minute',
					value: 10,
					reason: 'Recorte global'
				});
			})
		).toBe('VALIDATION_ERROR');
	});

	it('el cambio de sobrescrituras también queda en la auditoría de la app', () => {
		updateAppOverrides(ctx.deps, {
			actorId: ctx.adminId,
			appId: SEEDED_APP_ID,
			overrides: { max_audio_seconds: 240 },
			reason: 'Ajuste de audio'
		});

		expect(auditRowsFor(SEEDED_APP_ID)).toBe(1);
	});
});

describe('configuración efectiva (BE-FR-61 CA2, BE-FR-31)', () => {
	it('una operación sin margen propio hereda el margen global', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('fix'));

		const config = getEffectiveConfig(ctx.deps, { appId, operationKey: 'fix' });

		expect(config.operation?.marginPpm).toBe(2_000_000);
	});

	it('el margen de la operación gana al global', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('translate', { marginOverridePpm: 1_500_000 }));

		expect(
			getEffectiveConfig(ctx.deps, { appId, operationKey: 'translate' }).operation?.marginPpm
		).toBe(1_500_000);
	});

	it('los límites de tamaño de la operación ganan a los de la app', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('corto', { limits: { max_text_chars: 1_000 } }));

		expect(
			getEffectiveConfig(ctx.deps, { appId, operationKey: 'corto' }).operation?.limits
		).toEqual({
			max_text_chars: 1_000,
			max_image_mb: 10
		});
	});

	it('una operación inactiva no se atiende (BE-FR-31)', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('pausa', { active: false, model: null }));

		expect(codeOf(() => getEffectiveConfig(ctx.deps, { appId, operationKey: 'pausa' }))).toBe(
			'VALIDATION_ERROR'
		);
	});

	it('una operación desconocida no se atiende y una app desconocida devuelve UNKNOWN_APP', () => {
		expect(
			codeOf(() =>
				getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID, operationKey: 'no-existe' })
			)
		).toBe('VALIDATION_ERROR');
		expect(codeOf(() => getEffectiveConfig(ctx.deps, { appId: 'app_no_existe' }))).toBe(
			'UNKNOWN_APP'
		);
	});
});

describe('altas sin redesplegar (BE-FR-62 CA2)', () => {
	it('una app nueva y su operación sirven en cuanto se dan de alta', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('fix'));

		const config = getEffectiveConfig(ctx.deps, { appId, operationKey: 'fix' });

		expect(config.appId).toBe(appId);
		expect(config.operation?.key).toBe('fix');
		expect(
			db()
				.select()
				.from(apps)
				.all()
				.map((app) => app.slug)
		).toContain('otra-app');
	});

	it('un slug nuevo se puede crear sin tocar las demás apps', () => {
		const id = createApp(ctx.deps, ctx.adminId, {
			slug: 'tercera-app',
			name: 'Tercera',
			clientTypes: ['desktop'],
			links: { landing: { type: 'internal' } },
			syncSchema: { categories: { notas: { strategy: 'block' } } }
		});

		expect(
			db()
				.select()
				.from(appOperations)
				.all()
				.filter((o) => o.appId === id)
		).toHaveLength(0);
		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			200_000
		);
	});
});

describe('JSON corrupto al leer (BE-FR-61 CA5)', () => {
	it('una columna con forma incorrecta se rechaza al leer, se registra y el dato no cambia', () => {
		raw(`UPDATE apps SET links = '{"landing":5}' WHERE id = '${SEEDED_APP_ID}'`);

		expect(codeOf(() => getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }))).toBe(
			'INTERNAL_ERROR'
		);
		expect(eventsNamed(ctx.logger, 'apps.config.corrupt')[0]?.fields).toEqual({
			table: 'apps',
			field: 'links'
		});
		expect(rawValue(`SELECT links FROM apps WHERE id = '${SEEDED_APP_ID}'`)).toEqual({
			links: '{"landing":5}'
		});
	});

	it('una operación con capacidades corruptas se rechaza al resolverla', () => {
		const appId = addSecondApp(ctx);
		addOperation(ctx, appId, chatOperation('fix'));
		raw(`UPDATE app_operations SET capabilities = '{"image_input":"sí"}' WHERE key = 'fix'`);

		expect(codeOf(() => getEffectiveConfig(ctx.deps, { appId, operationKey: 'fix' }))).toBe(
			'INTERNAL_ERROR'
		);
		expect(eventsNamed(ctx.logger, 'apps.config.corrupt')[0]?.fields).toMatchObject({
			table: 'app_operations',
			field: 'capabilities'
		});
	});
});

describe('plantillas inmutables por versión (BE-FR-78, BE-FR-79)', () => {
	it('cada publicación crea una versión nueva y la anterior se conserva', () => {
		const appId = addSecondApp(ctx);
		const operationId = addOperation(ctx, appId, chatOperation('plantilla', { mode: 'plantilla' }));
		const body = {
			messages: [{ role: 'system', content: 'Eres un corrector.' }],
			variables: []
		};

		expect(createTemplateVersion(ctx.deps, { actorId: ctx.adminId, operationId, body })).toBe(1);
		expect(createTemplateVersion(ctx.deps, { actorId: ctx.adminId, operationId, body })).toBe(2);
	});

	it('una operación en modo libre no admite plantillas', () => {
		const appId = addSecondApp(ctx);
		const operationId = addOperation(ctx, appId, chatOperation('libre'));

		expect(
			codeOf(() =>
				createTemplateVersion(ctx.deps, {
					actorId: ctx.adminId,
					operationId,
					body: { messages: [{ role: 'user', content: 'hola' }], variables: [] }
				})
			)
		).toBe('VALIDATION_ERROR');
	});

	it('una plantilla que usa una variable no declarada se rechaza', () => {
		const appId = addSecondApp(ctx);
		const operationId = addOperation(ctx, appId, chatOperation('plantilla', { mode: 'plantilla' }));

		expect(
			codeOf(() =>
				createTemplateVersion(ctx.deps, {
					actorId: ctx.adminId,
					operationId,
					body: { messages: [{ role: 'user', content: 'Corrige {{texto}}' }], variables: [] }
				})
			)
		).toBe('VALIDATION_ERROR');
	});
});
