// Topes de las sobrescrituras por app frente al global contra SQLite real (BE-FR-61 CA4; D06 = R01 y D07 = R02 de la propuesta de
// administración). Cubre las cuatro claves con global, las cuatro sin global, y el rechazo de bajar un global con detalle de las apps.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/shared/errors';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '../audit/schema';
import { getEffectiveConfig, getSetting, updateAppOverrides, updateSetting } from './index';

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

/** Error de aplicación que lanza una función, o `undefined` si no lanza. */
function errorOf(action: () => unknown): AppError | undefined {
	try {
		action();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error : undefined;
	}
}

/** Detalle de conflictos de un rechazo por bajar un global (lista vacía si no lo hay). */
function conflictsOf(error: AppError | undefined): unknown[] {
	const value = error?.details.conflicts;
	return Array.isArray(value) ? value : [];
}

function auditRowsFor(entityId: string): number {
	return db()
		.select()
		.from(adminAudit)
		.all()
		.filter((row) => row.entityId === entityId).length;
}

function overrideOf(overrides: Parameters<typeof updateAppOverrides>[1]['overrides']) {
	return {
		actorId: ctx.adminId,
		appId: SEEDED_APP_ID,
		overrides,
		reason: 'Ajuste de prueba'
	};
}

describe('topes por app para las claves con global (D06 = R01)', () => {
	it('max_text_chars: una app no puede superar el global (200.000) y se rechaza con su evento', () => {
		const error = errorOf(() => {
			updateAppOverrides(ctx.deps, overrideOf({ max_text_chars: 200_001 }));
		});

		expect(error?.code).toBe('VALIDATION_ERROR');
		expect(eventsNamed(ctx.logger, 'apps.settings.rejected')[0]?.fields).toMatchObject({
			reason: 'ceiling'
		});
	});

	it('max_text_chars: igual al global se acepta (el tope es inclusivo)', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_text_chars: 200_000 }));

		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			200_000
		);
	});

	it('max_image_mb: una app no puede superar el global (10 MB)', () => {
		expect(
			errorOf(() => {
				updateAppOverrides(ctx.deps, overrideOf({ max_image_mb: 11 }));
			})?.code
		).toBe('VALIDATION_ERROR');

		updateAppOverrides(ctx.deps, overrideOf({ max_image_mb: 10 }));
		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_image_mb).toBe(10);
	});

	it('las claves sin global (max_audio_seconds, audio_duration_tolerance_seconds, max_audio_mb, max_sync_doc_kb) no tienen techo', () => {
		updateAppOverrides(
			ctx.deps,
			overrideOf({
				max_audio_seconds: 10_000_000,
				audio_duration_tolerance_seconds: 10_000_000,
				max_audio_mb: 10_000_000,
				max_sync_doc_kb: 10_000_000
			})
		);

		const settings = getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings;
		expect(settings.max_audio_seconds).toBe(10_000_000);
		expect(settings.max_sync_doc_kb).toBe(10_000_000);
	});
});

describe('bajar un global por debajo de una sobrescritura (D07 = R02)', () => {
	it('max_text_chars: bajar el global por debajo de una sobrescritura se rechaza y no cambia nada', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_text_chars: 150_000 }));

		const error = errorOf(() => {
			updateSetting(ctx.deps, {
				actorId: ctx.adminId,
				key: 'max_text_chars',
				value: 100_000,
				reason: 'Recorte global'
			});
		});

		expect(error?.code).toBe('VALIDATION_ERROR');
		expect(getSetting(ctx.deps, 'max_text_chars')).toBe(200_000);
		expect(auditRowsFor('max_text_chars')).toBe(0);
	});

	it('el rechazo lista cada app y valor que impide el cambio, sin recortar nada en silencio', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_text_chars: 150_000 }));
		const otherId = addSecondApp(ctx, { settingsOverrides: { max_text_chars: 120_000 } });

		const error = errorOf(() => {
			updateSetting(ctx.deps, {
				actorId: ctx.adminId,
				key: 'max_text_chars',
				value: 100_000,
				reason: 'Recorte global'
			});
		});

		expect(conflictsOf(error)).toHaveLength(2);
		expect(conflictsOf(error)).toEqual(
			expect.arrayContaining([
				{
					appId: SEEDED_APP_ID,
					appSlug: 'secretario',
					appName: 'Secretario AI',
					key: 'max_text_chars',
					override: 150_000,
					global: 100_000
				},
				{
					appId: otherId,
					appSlug: 'otra-app',
					appName: 'Otra app',
					key: 'max_text_chars',
					override: 120_000,
					global: 100_000
				}
			])
		);
		expect(getSetting(ctx.deps, 'max_text_chars')).toBe(200_000);
		expect(getEffectiveConfig(ctx.deps, { appId: SEEDED_APP_ID }).settings.max_text_chars).toBe(
			150_000
		);
	});

	it('bajar el global hasta exactamente el valor de la sobrescritura se acepta', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_text_chars: 150_000 }));

		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_text_chars',
			value: 150_000,
			reason: 'Ajuste al tope'
		});

		expect(getSetting(ctx.deps, 'max_text_chars')).toBe(150_000);
	});

	it('max_image_mb: bajar el global por debajo de una sobrescritura se rechaza con detalle', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_image_mb: 8 }));

		const error = errorOf(() => {
			updateSetting(ctx.deps, {
				actorId: ctx.adminId,
				key: 'max_image_mb',
				value: 5,
				reason: 'Recorte global'
			});
		});

		expect(error?.code).toBe('VALIDATION_ERROR');
		expect(conflictsOf(error)).toHaveLength(1);
	});

	it('una clave sin global no se comprueba al bajar: max_audio_seconds no tiene techo que respetar', () => {
		updateAppOverrides(ctx.deps, overrideOf({ max_audio_seconds: 600 }));
		updateSetting(ctx.deps, {
			actorId: ctx.adminId,
			key: 'max_audio_seconds',
			value: 60,
			reason: 'Recorte de audio'
		});

		expect(getSetting(ctx.deps, 'max_audio_seconds')).toBe(60);
	});
});
