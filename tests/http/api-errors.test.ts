// Formato de error 7.1 y documento OpenAPI (contracts/api-v1.md 1.4 y E14; FR-062). Los errores de la API llevan
// `{ error: { code, message, details } }` y el documento OpenAPI es 3.1 con una estructura comprobada con Zod.
import { describe, expect, inject, it } from 'vitest';
import * as z from 'zod';
import { jsonOf, send } from './client';

const baseUrl = inject('httpBaseUrl');

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
	it('se sirve como OpenAPI 3.1 con su estructura y el error 7.1 como componente', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json');
		const document = openApiMinimal.parse(jsonOf(result));

		expect(result.status).toBe(200);
		expect(document.openapi).toBe('3.1.0');
		expect(document.paths).toHaveProperty('/health');
		expect(document.components.schemas).toHaveProperty('ApiError');
	});
});
