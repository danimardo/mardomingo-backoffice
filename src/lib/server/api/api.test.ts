import { describe, expect, it } from 'vitest';
import { ERROR_CODE_LIST, AppError } from '$lib/server/shared/errors';
import { createFakeLogger, eventsNamed } from '../../../../tests/builders/fake-logger';
import { makeApiEvent } from '../../../../tests/builders/request-event';
import {
	apiErrorBody,
	apiErrorResponse,
	appErrorResponse,
	validationErrorResponse
} from './errors';
import { ERROR_MESSAGES } from './error-messages';
import { apiFallback, apiRoute } from './handler';
import { API_NO_STORE_HEADERS, jsonResponse } from './headers';
import { buildOpenApiDocument } from './openapi';
import { openApiJson } from './openapi.cache';

describe('formato de error 7.1', () => {
	it('cada código tiene su texto de Paraglide', () => {
		for (const code of ERROR_CODE_LIST) {
			expect(ERROR_MESSAGES[code]()).not.toBe('');
		}
	});

	it('el cuerpo lleva código, mensaje y detalles, sin nada más', () => {
		expect(apiErrorBody('INSUFFICIENT_BALANCE', { details: { requiredMicro: 50 } })).toEqual({
			error: {
				code: 'INSUFFICIENT_BALANCE',
				message: 'No tienes saldo suficiente para esta operación.',
				details: { requiredMicro: 50 }
			}
		});
	});

	it('el estado HTTP sale del catálogo de códigos', async () => {
		const response = apiErrorResponse('INSUFFICIENT_BALANCE');

		expect(response.status).toBe(402);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toMatchObject({ error: { code: 'INSUFFICIENT_BALANCE' } });
	});

	it('un AppError se convierte con sus detalles', async () => {
		const response = appErrorResponse(new AppError('NOT_FOUND', { resource: 'app' }));

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ error: { details: { resource: 'app' } } });
	});

	it('una validación indica solo el campo, nunca el valor recibido', async () => {
		const response = validationErrorResponse('messages.1.content');
		const text = await response.text();

		expect(response.status).toBe(400);
		expect(text).toContain('"field":"messages.1.content"');
	});

	it('el mensaje de mantenimiento lo escribe el administrador', () => {
		const body = apiErrorBody('MAINTENANCE', { message: 'Volvemos a las 18:00.' });

		expect(body.error.message).toBe('Volvemos a las 18:00.');
	});
});

describe('jsonResponse', () => {
	it('fija JSON y no permite caché', () => {
		const response = jsonResponse({ ok: true }, { status: 200 });

		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(API_NO_STORE_HEADERS['cache-control']).toBe('no-store');
	});
});

describe('apiRoute', () => {
	it('devuelve la respuesta del manejador cuando no hay error', async () => {
		const handler = apiRoute(() => new Response('ok', { status: 201 }));

		const response = await handler(makeApiEvent());

		expect(response.status).toBe(201);
	});

	it('convierte un AppError en su respuesta de error', async () => {
		const handler = apiRoute(() => {
			throw new AppError('UNAUTHENTICATED');
		});

		const response = await handler(makeApiEvent());

		expect(response.status).toBe(401);
	});

	it('un error inesperado responde 500 INTERNAL_ERROR y se registra una sola vez', async () => {
		const logger = createFakeLogger();
		const handler = apiRoute(() => {
			throw new Error('fallo interno con datos sensibles');
		});

		const response = await handler(makeApiEvent({ logger }));
		const body: unknown = await response.json();

		expect(response.status).toBe(500);
		expect(body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
		expect(JSON.stringify(body)).not.toContain('datos sensibles');
		expect(eventsNamed(logger, 'http.request.failed')).toHaveLength(1);
	});
});

describe('apiFallback', () => {
	it('responde 405 con la cabecera Allow de la ruta', () => {
		const response = apiFallback(['GET', 'HEAD'])(makeApiEvent({ method: 'POST' }));

		expect(response.status).toBe(405);
		expect(response.headers.get('allow')).toBe('GET, HEAD');
	});
});

describe('documento OpenAPI', () => {
	it('declara OpenAPI 3.1, el servidor, el healthcheck y el error 7.1', () => {
		const document = buildOpenApiDocument('https://api.mardomingo.com');

		expect(document.openapi).toBe('3.1.0');
		expect(document.servers).toEqual([{ url: 'https://api.mardomingo.com/api/v1' }]);
		expect(document.paths).toHaveProperty('/health');
		expect(document.components?.schemas).toHaveProperty('ApiError');
	});

	it('se genera una vez y se reutiliza', () => {
		const first = openApiJson('https://api.mardomingo.com');
		const second = openApiJson('https://otro.example');

		expect(second).toBe(first);
		expect(JSON.parse(first)).toMatchObject({ openapi: '3.1.0' });
	});
});
