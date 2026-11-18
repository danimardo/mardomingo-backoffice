// C-14 (T406; BE-FR-71 CA1, BE-FR-11.6, BE-FR-46): `hold_ttl_seconds` debe superar la operación más larga (de cualquier app,
// activa o no: activarla no vuelve a validar) más un margen. Si la reserva caduca antes del cobro, deja de contar en el saldo
// disponible, en el tope diario y en el freno global. Contra SQLite real con las operaciones sembradas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/shared/errors';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { appsTestContext, type AppsTestContext } from '../../../../../tests/builders/apps';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { adminAudit } from '../audit/schema';
import { DEFAULT_SETTINGS } from './defaults';
import { getSetting, previewSettingChange, updateSetting } from './index';

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

function errorOf(action: () => unknown): AppError | undefined {
	try {
		action();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error : undefined;
	}
}

function update(value: number): void {
	updateSetting(ctx.deps, {
		actorId: ctx.adminId,
		key: 'hold_ttl_seconds',
		value,
		reason: 'Ajuste de la reserva'
	});
}

describe('hold_ttl_seconds frente a la operación más larga (C-14)', () => {
	it('la vista previa rechaza 60 s con las operaciones sembradas', () => {
		expect(previewSettingChange(ctx.deps, 'hold_ttl_seconds', 60)).toMatchObject({
			valid: false,
			after: null
		});
	});

	it('guardar 60 s se rechaza con su evento, sin escribir ni auditar', () => {
		const error = errorOf(() => {
			update(60);
		});

		expect(error?.code).toBe('VALIDATION_ERROR');
		expect(error?.details).toMatchObject({ field: 'value', minSeconds: 314 });
		expect(eventsNamed(ctx.logger, 'apps.settings.rejected')[0]?.fields).toEqual({
			key: 'hold_ttl_seconds',
			scope: 'global',
			reason: 'hold_ttl'
		});
		expect(getSetting(ctx.deps, 'hold_ttl_seconds')).toBe(DEFAULT_SETTINGS.hold_ttl_seconds);
		expect(database?.db.select().from(adminAudit).all()).toEqual([]);
	});

	it('el valor por defecto (600 s) y el mínimo (314 s: transcripción de 254 s + 60 s) se aceptan; 313 s no', () => {
		expect(previewSettingChange(ctx.deps, 'hold_ttl_seconds', 600)).toMatchObject({ valid: true });
		expect(previewSettingChange(ctx.deps, 'hold_ttl_seconds', 313)).toMatchObject({
			valid: false
		});

		update(314);
		expect(getSetting(ctx.deps, 'hold_ttl_seconds')).toBe(314);
		update(DEFAULT_SETTINGS.hold_ttl_seconds);
		expect(getSetting(ctx.deps, 'hold_ttl_seconds')).toBe(600);
	});
});
