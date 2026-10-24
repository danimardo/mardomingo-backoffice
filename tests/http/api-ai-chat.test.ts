// `POST /api/v1/ai/chat` contra el build y el simulador de OpenRouter (api-v1 E07, 1.6, 1.7; T178). Las pruebas se
// ejecutan en orden: el saldo de la cuenta de chat sembrada es el hilo que las une. Cada cobro es de 776.480 µc (0,0004 USD
// con los valores por defecto; api-v1 7.3). Un fallo, una moderación o una cancelación no cobran.
import { request } from 'node:http';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { send } from './client';
import { CHAT_CALLS_PATH } from '../mock-servers/openrouter';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const mockUrl = inject('openrouterMockUrl');
const apiHost = new URL(baseUrl).host;
const WELCOME_MICRO = 1_000_000_000;
const CHARGE_MICRO = 776_480;
const UUID = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const headers = {
	'content-type': 'application/json',
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${token}`
};

/** Cabeceras sin Bearer, para comprobar el 401. */
const headersWithoutBearer = {
	'content-type': 'application/json',
	accept: 'application/json',
	'x-app-id': 'secretario'
};

const body = (content = 'Revisa este párrafo, por favor.') =>
	JSON.stringify({ operation: 'improve', messages: [{ role: 'user', content }] });

/** Saldo que devuelve el servidor tras cada cobro; las pruebas lo siguen de una a otra. */
let balance = WELCOME_MICRO;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parse(text: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text);
	return isRecord(parsed) ? parsed : {};
}

function errorOf(text: string): { code: unknown; details: Record<string, unknown> } {
	const error = parse(text).error;
	if (!isRecord(error)) throw new Error('sin error en formato 7.1');
	return { code: error.code, details: isRecord(error.details) ? error.details : {} };
}

/** Cambia el escenario del simulador de OpenRouter. */
function scenario(name: string): Promise<unknown> {
	return send(mockUrl, '/__scenario', { method: 'POST', body: name });
}

/** Llamadas de chat que ha recibido el simulador de OpenRouter. */
async function chatCalls(): Promise<number> {
	const result = await send(mockUrl, CHAT_CALLS_PATH);
	const parsed: unknown = JSON.parse(result.text);
	return typeof parsed === 'number' ? parsed : -1;
}

/** Espera a que una condición se cumpla, con un límite de 3 s. */
async function waitUntil(condition: () => Promise<boolean>): Promise<void> {
	const deadline = Date.now() + 3_000;
	while (Date.now() < deadline) {
		if (await condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

afterEach(async () => {
	await scenario('ok');
});

describe('POST /api/v1/ai/chat', () => {
	it('[BE-FR-80/CA1] un chat válido cobra 776.480 µc y responde con el texto y el saldo, sin modelo ni proveedor', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});

		expect(result.status).toBe(200);
		const response = parse(result.text);
		expect(response).toMatchObject({
			text: 'Respuesta simulada',
			json: null,
			structuredValid: null,
			toolCalls: null,
			truncated: false,
			chargedMicro: CHARGE_MICRO,
			balance: {
				totalMicro: WELCOME_MICRO - CHARGE_MICRO,
				reservedMicro: 0,
				availableMicro: WELCOME_MICRO - CHARGE_MICRO,
				debtMicro: 0
			}
		});
		expect(response).not.toHaveProperty('model');
		expect(response).not.toHaveProperty('provider');
		expect(result.text).not.toContain('mistral');
		expect(typeof response.operationId).toBe('string');
		balance = WELCOME_MICRO - CHARGE_MICRO;
	});

	it('una clave de idempotencia repetida tras la entrega responde 409 DUPLICATE_REQUEST, sin cobrar de nuevo', async () => {
		const first = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers: { ...headers, 'idempotency-key': UUID },
			body: body()
		});
		expect(first.status).toBe(200);
		balance -= CHARGE_MICRO;
		const firstId = parse(first.text).operationId;

		const repeated = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers: { ...headers, 'idempotency-key': UUID },
			body: body()
		});

		expect(repeated.status).toBe(409);
		expect(errorOf(repeated.text)).toEqual({
			code: 'DUPLICATE_REQUEST',
			details: { operationId: firstId }
		});
	});

	it('una cabecera Idempotency-Key que no es un UUID responde 400 con su campo', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers: { ...headers, 'idempotency-key': 'no-es-uuid' },
			body: body()
		});

		expect(result.status).toBe(400);
		expect(errorOf(result.text)).toMatchObject({
			code: 'VALIDATION_ERROR',
			details: { field: 'Idempotency-Key' }
		});
	});

	it('un campo desconocido en el cuerpo responde 400 VALIDATION_ERROR (esquema estricto)', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: JSON.stringify({
				operation: 'improve',
				messages: [{ role: 'user', content: 'x' }],
				modelo: 'gpt'
			})
		});

		expect(result.status).toBe(400);
		expect(errorOf(result.text).code).toBe('VALIDATION_ERROR');
	});

	it('una operación que no existe responde 400 con field operation, sin cobro', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: JSON.stringify({ operation: 'no_existe', messages: [{ role: 'user', content: 'x' }] })
		});

		expect(result.status).toBe(400);
		expect(errorOf(result.text)).toEqual({
			code: 'VALIDATION_ERROR',
			details: { field: 'operation' }
		});
	});

	it('sin Bearer, la API responde 401 UNAUTHENTICATED', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers: headersWithoutBearer,
			body: body()
		});

		expect(result.status).toBe(401);
		expect(errorOf(result.text).code).toBe('UNAUTHENTICATED');
	});

	it('un texto por encima de max_text_chars responde 413 PAYLOAD_TOO_LARGE', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body('x'.repeat(200_001))
		});

		expect(result.status).toBe(413);
		expect(errorOf(result.text).code).toBe('PAYLOAD_TOO_LARGE');
	});

	it('si el proveedor falla en todos sus intentos, responde 502 PROVIDER_ERROR y no cobra', async () => {
		await scenario('http_500');

		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});

		expect(result.status).toBe(502);
		expect(errorOf(result.text).code).toBe('PROVIDER_ERROR');
		expect(result.text).not.toContain('interno del proveedor');
		await scenario('ok');

		const next = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});
		expect(parse(next.text).balance).toMatchObject({ totalMicro: balance - CHARGE_MICRO });
		balance -= CHARGE_MICRO;
	});

	it('una moderación del proveedor responde 502 con un mensaje genérico, sin contenido y sin cobro', async () => {
		await scenario('moderation');

		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});

		expect(result.status).toBe(502);
		expect(errorOf(result.text).code).toBe('PROVIDER_ERROR');
		expect(result.text).not.toContain('no-debe-llegar');
		await scenario('ok');

		const next = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});
		expect(parse(next.text).balance).toMatchObject({ totalMicro: balance - CHARGE_MICRO });
		balance -= CHARGE_MICRO;
	});

	it('[BE-FR-37/CA1] si el cliente cierra la conexión mientras el proveedor responde, la operación se cancela sin cobro (D-05)', async () => {
		await scenario('timeout');
		const before = await chatCalls();
		await new Promise<void>((resolve) => {
			const req = request(
				{
					host: new URL(baseUrl).hostname,
					port: new URL(baseUrl).port,
					path: '/api/v1/ai/chat',
					method: 'POST',
					headers: { ...headers, host: apiHost }
				},
				() => {
					return;
				}
			);
			req.on('error', () => {
				resolve();
			});
			req.end(body());
			// Se corta solo cuando el servidor ya ha llamado al proveedor: así la prueba no depende del reloj.
			void waitUntil(async () => (await chatCalls()) > before).then(() => {
				req.destroy();
				resolve();
			});
		});
		expect(await chatCalls()).toBe(before + 1);
		await scenario('ok');

		const next = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: body()
		});
		expect(next.status).toBe(200);
		expect(parse(next.text).balance).toMatchObject({ totalMicro: balance - CHARGE_MICRO });
		balance -= CHARGE_MICRO;
	});

	it('el método GET responde 405 METHOD_NOT_ALLOWED', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', { host: apiHost, headers });

		expect(result.status).toBe(405);
		expect(errorOf(result.text).code).toBe('METHOD_NOT_ALLOWED');
	});
});
