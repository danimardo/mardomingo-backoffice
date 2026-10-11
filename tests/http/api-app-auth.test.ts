// Autenticación de la API por app contra el build (T139; BE-FR-62 CA1, BE-FR-65 CA1–CA3, BE-FR-06; contracts/api-v1.md
// 1.2, 1.4). Sin usuarios de prueba por HTTP (no hay simulador de captcha en el build): se prueban las cabeceras, el origen,
// la validación, las credenciales erróneas, la sesión ausente y los métodos. El login con éxito lo cubre la integración.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const apiHost = new URL(baseUrl).host;
const SECRETARIO = 'secretario';
const json = { 'content-type': 'application/json', accept: 'application/json' };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorOf(text: string): { code: string; details: Record<string, unknown> } {
	const body: unknown = JSON.parse(text);
	if (!isRecord(body) || !isRecord(body.error)) throw new Error('sin error en formato 7.1');
	const { code, details } = body.error;
	return {
		code: typeof code === 'string' ? code : '',
		details: isRecord(details) ? details : {}
	};
}

describe('cabecera X-App-Id', () => {
	it('sin X-App-Id, una ruta de la API responde 400 UNKNOWN_APP con su formato y X-Request-Id', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: json,
			body: '{}'
		});

		expect(result.status).toBe(400);
		expect(errorOf(result.text).code).toBe('UNKNOWN_APP');
		expect(result.headers['x-request-id']).toBeDefined();
	});

	it('con una app desconocida, también 400 UNKNOWN_APP', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': 'no-existe' },
			body: '{}'
		});

		expect(errorOf(result.text).code).toBe('UNKNOWN_APP');
	});

	it('el healthcheck no exige app', async () => {
		const result = await send(baseUrl, '/api/v1/health', { host: apiHost });

		expect(result.status).toBe(200);
	});
});

describe('origen de la API', () => {
	it('un _preflight_ de un origen que ninguna app permite responde 403 ORIGIN_NOT_ALLOWED', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'OPTIONS',
			host: apiHost,
			headers: {
				origin: 'https://ajena.example',
				'access-control-request-method': 'POST'
			}
		});

		expect(result.status).toBe(403);
		expect(errorOf(result.text).code).toBe('ORIGIN_NOT_ALLOWED');
		expect(result.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('una petición real de un origen ajeno a la app también responde 403', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, origin: 'https://ajena.example', 'x-app-id': SECRETARIO },
			body: '{}'
		});

		expect(result.status).toBe(403);
		expect(errorOf(result.text).code).toBe('ORIGIN_NOT_ALLOWED');
	});
});

describe('login de app', () => {
	it('un cuerpo que no encaja responde 400 VALIDATION_ERROR con el campo, nunca el valor', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': SECRETARIO },
			body: JSON.stringify({ email: 'no-es-un-email', password: 'x' })
		});

		expect(result.status).toBe(400);
		const error = errorOf(result.text);
		expect(error.code).toBe('VALIDATION_ERROR');
		expect(error.details).toEqual({ field: 'email' });
		expect(result.text).not.toContain('no-es-un-email');
	});

	it('un campo de más en el cuerpo es un error de validación (esquema estricto)', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': SECRETARIO },
			body: JSON.stringify({ email: 'nadie@ejemplo.es', password: 'x', extra: true })
		});

		expect(errorOf(result.text).code).toBe('VALIDATION_ERROR');
	});

	it('credenciales erróneas dan 401 INVALID_CREDENTIALS, sin contraseña en la respuesta y sin cookie', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': SECRETARIO },
			body: JSON.stringify({ email: 'nadie@ejemplo.es', password: 'mal-escrita-123' })
		});

		expect(result.status).toBe(401);
		expect(errorOf(result.text).code).toBe('INVALID_CREDENTIALS');
		expect(result.text).not.toContain('mal-escrita-123');
		expect(result.headers['set-cookie']).toBeUndefined();
		expect(result.headers['cache-control']).toContain('no-store');
	});

	it('GET en la ruta de login responde 405 METHOD_NOT_ALLOWED con Allow', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'GET',
			host: apiHost,
			headers: { 'x-app-id': SECRETARIO }
		});

		expect(result.status).toBe(405);
		expect(errorOf(result.text).code).toBe('METHOD_NOT_ALLOWED');
		expect(result.headers.allow).toBe('POST');
	});
});

describe('sesión de la API', () => {
	it('logout sin sesión responde 401 UNAUTHENTICATED', async () => {
		const result = await send(baseUrl, '/api/v1/auth/logout', {
			method: 'POST',
			host: apiHost,
			headers: { 'x-app-id': SECRETARIO }
		});

		expect(result.status).toBe(401);
		expect(errorOf(result.text).code).toBe('UNAUTHENTICATED');
	});

	it('una cookie de la web no autentica en la API', async () => {
		const result = await send(baseUrl, '/api/v1/auth/logout', {
			method: 'POST',
			host: apiHost,
			headers: {
				'x-app-id': SECRETARIO,
				cookie: 'better-auth.session_token=cookie-falsa'
			}
		});

		expect(result.status).toBe(401);
		expect(result.headers['set-cookie']).toBeUndefined();
	});

	it('logout con cuerpo responde 400 VALIDATION_ERROR (el cuerpo debe estar vacío)', async () => {
		const result = await send(baseUrl, '/api/v1/auth/logout', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': SECRETARIO },
			body: '{"x":1}'
		});

		expect(result.status).toBe(400);
		expect(errorOf(result.text).code).toBe('VALIDATION_ERROR');
	});
});

describe('reenvío de verificación', () => {
	it('responde 202 sin cuerpo, exista o no la cuenta', async () => {
		const result = await send(baseUrl, '/api/v1/auth/resend-verification', {
			method: 'POST',
			host: apiHost,
			headers: { ...json, 'x-app-id': SECRETARIO },
			body: JSON.stringify({ email: 'nadie-que-no-existe@ejemplo.es' })
		});

		expect(result.status).toBe(202);
		expect(result.text).toBe('');
	});
});
