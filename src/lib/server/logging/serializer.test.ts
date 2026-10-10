import { describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/shared/errors';
import { LOG_REDACT_PATHS, serializeErr } from './serializer';

const SECRET_MESSAGE = 'SELECT * FROM users WHERE email = "ana@example.com"';

describe('serializeErr', () => {
	it('nunca incluye el mensaje de un error de biblioteca', () => {
		const error = new Error(SECRET_MESSAGE);
		error.name = 'SqliteError';

		const serialized = serializeErr(error);

		expect(serialized.type).toBe('SqliteError');
		expect(JSON.stringify(serialized)).not.toContain('ana@example.com');
		expect(JSON.stringify(serialized)).not.toContain(SECRET_MESSAGE);
	});

	it('conserva solo las líneas de la pila, no la primera que repite el mensaje', () => {
		const error = new Error(SECRET_MESSAGE);
		error.stack = `Error: ${SECRET_MESSAGE}\n    at query (db.ts:10:5)\n    at run (app.ts:3:1)`;

		expect(serializeErr(error).stack).toBe('    at query (db.ts:10:5)\n    at run (app.ts:3:1)');
	});

	it('incluye el código de error de Node cuando existe', () => {
		const error = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });

		expect(serializeErr(error).code).toBe('ENOENT');
	});

	it('un AppError registra su código tipado y nunca la pila', () => {
		const serialized = serializeErr(new AppError('NOT_FOUND'));

		expect(serialized).toEqual({ type: 'AppError', code: 'NOT_FOUND' });
	});

	it('acepta un informe ya saneado del navegador y descarta los campos extra', () => {
		const serialized = serializeErr({
			type: 'TypeError',
			code: 'a1b2c3d4',
			stack: '    at render (app.js:1:2)',
			message: SECRET_MESSAGE
		});

		expect(serialized).toEqual({
			type: 'TypeError',
			code: 'a1b2c3d4',
			stack: '    at render (app.js:1:2)'
		});
	});

	it('un valor que no es error se marca como desconocido', () => {
		expect(serializeErr(SECRET_MESSAGE)).toEqual({ type: 'unknown' });
		expect(serializeErr(undefined)).toEqual({ type: 'unknown' });
	});
});

describe('LOG_REDACT_PATHS', () => {
	it('cubre las claves que nunca pueden salir en un log', () => {
		for (const key of [
			'authorization',
			'cookie',
			'password',
			'token',
			'email',
			'idempotencyKey',
			'ip'
		]) {
			expect(LOG_REDACT_PATHS).toContain(key);
			expect(LOG_REDACT_PATHS).toContain(`*.${key}`);
		}
	});
});
