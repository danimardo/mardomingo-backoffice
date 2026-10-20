// Formato de error 7.1 y documento OpenAPI (contracts/api-v1.md 1.4 y E14; FR-062). Los errores de la API llevan
// `{ error: { code, message, details } }` y el documento OpenAPI es 3.1 con una estructura comprobada con Zod.
import { describe, expect, inject, it } from 'vitest';
import * as z from 'zod';
import { jsonOf, send } from './client';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');

const appHeaders = { 'x-app-id': 'secretario', 'x-app-version': '4.0.0' };
const signedIn = { ...appHeaders, authorization: `Bearer ${token}` };

const apiErrorBody = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown())
	})
});

const openApiMinimal = z.object({
	openapi: z.literal('3.1.0'),
	info: z.object({ title: z.string(), version: z.string() }),
	servers: z.array(z.object({ url: z.string() })),
	paths: z.record(z.string(), z.unknown()),
	components: z.object({ schemas: z.record(z.string(), z.unknown()) })
});

describe('errores de la API en formato 7.1', () => {
	it('una ruta inexistente responde 404 NOT_FOUND', async () => {
		const result = await send(baseUrl, '/api/v1/no-existe');
		const body = apiErrorBody.parse(jsonOf(result));

		expect(result.status).toBe(404);
		expect(body.error.code).toBe('NOT_FOUND');
		expect(body.error.details).toEqual({});
	});

	it('un método no previsto responde 405 METHOD_NOT_ALLOWED con Allow', async () => {
		const result = await send(baseUrl, '/api/v1/health', { method: 'DELETE' });
		const body = apiErrorBody.parse(jsonOf(result));

		expect(result.status).toBe(405);
		expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
		expect(result.headers.allow).toBe('GET');
	});
});

describe('documento OpenAPI', () => {
	it('con sesión se sirve como OpenAPI 3.1 con su estructura y el error 7.1 como componente', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', { headers: signedIn });
		const document = openApiMinimal.parse(jsonOf(result));

		expect(result.status).toBe(200);
		expect(document.openapi).toBe('3.1.0');
		expect(document.paths).toHaveProperty('/health');
		expect(document.components.schemas).toHaveProperty('ApiError');
		expect(result.headers['cache-control']).toBe('private, no-store');
	});

	it('no es público: sin sesión responde 401 UNAUTHENTICATED y no revela el documento', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', { headers: appHeaders });

		expect(result.status).toBe(401);
		expect(apiErrorBody.parse(jsonOf(result)).error.code).toBe('UNAUTHENTICATED');
		expect(result.text).not.toContain('"openapi"');
	});

	it('con un token inventado también responde 401', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', {
			headers: { ...appHeaders, authorization: 'Bearer token-inventado' }
		});

		expect(result.status).toBe(401);
		expect(result.text).not.toContain('"openapi"');
	});

	it('sin X-App-Id responde 400 UNKNOWN_APP, ni siquiera con token', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', {
			headers: { authorization: `Bearer ${token}` }
		});

		expect(result.status).toBe(400);
		expect(apiErrorBody.parse(jsonOf(result)).error.code).toBe('UNKNOWN_APP');
	});

	it('el token cuenta aunque la app esté en una versión antigua: es documentación y no se bloquea por versión', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', {
			headers: { ...signedIn, 'x-app-version': '0.0.1' }
		});

		expect(result.status).toBe(200);
	});
});
