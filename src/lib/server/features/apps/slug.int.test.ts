// Slug de una app contra SQLite real (BE-FR-62 CA2; D10 = R15 de la propuesta de administración): el formato se valida al dar de
// alta con un error de campo, y el slug no cambia después: ninguna actualización de la ficha lo toca.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/shared/errors';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { appsTestContext, type AppsTestContext } from '../../../../../tests/builders/apps';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { SECRETARIO_SYNC_SCHEMA } from './defaults';
import { createApp, updateAppDetails } from './index';

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

function slugOf(id: string): unknown {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	return database.sqlite
		.prepare<[string], { slug: string }>('SELECT slug FROM apps WHERE id = ?')
		.get(id)?.slug;
}

function newApp(slug: string) {
	return {
		slug,
		name: 'Prueba de slug',
		clientTypes: ['desktop'],
		links: { landing: { type: 'internal' } },
		syncSchema: { categories: { notas: { strategy: 'block' } } }
	};
}

/** Error de aplicación que lanza el alta con ese slug, o `undefined` si la alta se acepta. */
function altaErrorOf(slug: string): AppError | undefined {
	try {
		createApp(ctx.deps, ctx.adminId, newApp(slug));
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error : undefined;
	}
}

describe('formato del slug al dar de alta (D10 = R15)', () => {
	it('acepta el mínimo de dos caracteres y rechaza uno solo con error de campo slug', () => {
		expect(altaErrorOf('ab')).toBeUndefined();

		const error = altaErrorOf('a');
		expect(error?.code).toBe('VALIDATION_ERROR');
		expect(error?.details).toEqual({ field: 'slug' });
	});

	it('acepta cuarenta caracteres y rechaza cuarenta y uno', () => {
		expect(altaErrorOf(`a${'b'.repeat(39)}`)).toBeUndefined();

		expect(altaErrorOf(`a${'b'.repeat(40)}`)?.details).toEqual({ field: 'slug' });
	});

	it('rechaza el formato incorrecto con error de campo slug (mayúsculas, dígito inicial, espacios, guion bajo)', () => {
		for (const slug of ['Secretaria', '1ab', 'ab c', 'ab_c']) {
			expect(altaErrorOf(slug)?.details).toEqual({ field: 'slug' });
		}
	});

	it('un slug con guion interior y dígito se da de alta', () => {
		expect(altaErrorOf('ab-c2')).toBeUndefined();
	});
});

describe('el slug no cambia tras el alta (D10 = R15)', () => {
	it('actualizar la ficha de una app no toca su slug aunque se intente pasar otro', () => {
		const attempted = { slug: 'otro-slug' };
		updateAppDetails(ctx.deps, {
			actorId: ctx.adminId,
			appId: SEEDED_APP_ID,
			name: 'Secretario AI',
			description: '',
			supportEmail: null,
			postVerifyText: null,
			links: { landing: { type: 'internal' } },
			allowedOrigins: [],
			syncSchema: SECRETARIO_SYNC_SCHEMA,
			reason: 'Revisión de ficha',
			...attempted
		});

		expect(slugOf(SEEDED_APP_ID)).toBe('secretario');
	});
});
