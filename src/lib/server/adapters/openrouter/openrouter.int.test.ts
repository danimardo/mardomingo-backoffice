// Adaptador real de OpenRouter contra su simulador HTTP (Historias 15.10, 15.23; T176). Comprueba las cabeceras y
// `data_collection: "deny"`, el coste de `usage.cost` y de `/generation`, los errores saneados, la moderación, el
// catálogo con precios convertidos a enteros, y que los campos extra no llegan al cliente.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	startOpenRouterMock,
	CHAT_PATH,
	GENERATION_PATH,
	MODELS_PATH
} from '../../../../../tests/mock-servers/openrouter';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { createOpenRouterGateway, perTokenToPerMTokMicroUsd, usdToMicroUsd } from './openrouter';
import type { ChatRequest } from './gateway';

const KEY = 'sk-or-prueba-no-real';
let mock: MockServer;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Cuerpo JSON de una petición recibida por el simulador. */
function bodyOf(text: string | undefined): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text ?? '{}');
	return isRecord(parsed) ? parsed : {};
}

beforeAll(async () => {
	mock = await startOpenRouterMock();
});

afterAll(async () => {
	await mock.close();
});

beforeEach(() => {
	mock.scenario('ok');
});

function gateway() {
	return createOpenRouterGateway({ baseUrl: mock.url, apiKey: KEY });
}

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
	return {
		model: 'mistralai/mistral-small',
		messages: [{ role: 'user', content: 'Hola' }],
		maxTokens: 512,
		temperature: 0.7,
		requireParameters: false,
		appTitle: 'Secretario AI',
		timeoutMs: 5_000,
		signal: new AbortController().signal,
		...overrides
	};
}

describe('petición de chat a OpenRouter', () => {
	it('envía la clave, la referencia y el título, y pide no usar los datos para entrenar', async () => {
		await gateway().chat(request());

		const sent = mock.requests.at(-1);
		expect(sent?.path).toBe(CHAT_PATH);
		expect(sent?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(sent?.headers['http-referer']).toBe('https://api.mardomingo.com');
		expect(sent?.headers['x-title']).toBe('Secretario AI');
		const body = bodyOf(sent?.body);
		expect(body.provider).toMatchObject({ data_collection: 'deny', allow_fallbacks: true });
		expect(body).not.toHaveProperty('usage');
		expect(body).toMatchObject({ max_tokens: 512, temperature: 0.7 });
	});

	it('pide require_parameters solo cuando la operación usa salida estructurada o herramientas', async () => {
		await gateway().chat(
			request({ requireParameters: true, responseFormat: { type: 'json_schema' } })
		);

		const body = bodyOf(mock.requests.at(-1)?.body);
		expect(body.provider).toMatchObject({ require_parameters: true });
	});

	it('con usage.cost, devuelve el coste en micro-USD y el texto', async () => {
		const outcome = await gateway().chat(request());

		expect(outcome).toMatchObject({
			status: 'ok',
			text: 'Respuesta simulada',
			costMicroUsd: 400,
			inputTokens: 100,
			outputTokens: 50,
			truncated: false,
			generationId: 'gen-simulada-1'
		});
	});

	it('no devuelve campos extra del proveedor al cliente', async () => {
		mock.scenario('extra_fields');
		const outcome = await gateway().chat(request());

		expect(outcome.status).toBe('ok');
		expect(JSON.stringify(outcome)).not.toContain('no debe llegar al cliente');
	});

	it('sin usage.cost, el coste se obtiene de /generation con el id de la respuesta', async () => {
		mock.scenario('no_cost');
		const outcome = await gateway().chat(request());
		expect(outcome).toMatchObject({ status: 'ok', costMicroUsd: null });

		const cost = await gateway().generationCostMicroUsd(
			'gen-simulada-1',
			new AbortController().signal
		);
		expect(cost).toBe(1200);
		expect(mock.requests.at(-1)).toMatchObject({ path: GENERATION_PATH });
	});

	it('si /generation no responde, el coste es desconocido (null)', async () => {
		mock.scenario('no_cost_no_generation');

		expect(
			await gateway().generationCostMicroUsd('gen-x', new AbortController().signal)
		).toBeNull();
	});

	it('una respuesta truncada se marca como truncada', async () => {
		mock.scenario('truncated');

		expect(await gateway().chat(request())).toMatchObject({ status: 'ok', truncated: true });
	});

	it('un error HTTP se devuelve como error con su estado, sin el mensaje del proveedor', async () => {
		mock.scenario('http_500');
		const outcome = await gateway().chat(request());

		expect(outcome).toEqual({ status: 'error', reason: 'http', httpStatus: 500 });
		expect(JSON.stringify(outcome)).not.toContain('interno del proveedor');
	});

	it('un rechazo de parámetros (404) es un error HTTP', async () => {
		mock.scenario('require_parameters');

		expect(await gateway().chat(request({ requireParameters: true }))).toEqual({
			status: 'error',
			reason: 'http',
			httpStatus: 404
		});
	});

	it('un cuerpo que no es JSON es inválido', async () => {
		mock.scenario('invalid_json');

		expect(await gateway().chat(request())).toEqual({
			status: 'error',
			reason: 'invalid',
			httpStatus: 200
		});
	});

	it('una respuesta que no encaja con el esquema es inválida', async () => {
		mock.scenario('ok');
		const failing = createOpenRouterGateway({
			baseUrl: mock.url,
			apiKey: KEY,
			fetch: () => Promise.resolve(new Response(JSON.stringify({ id: 'x' }), { status: 200 }))
		});

		expect(await failing.chat(request())).toEqual({
			status: 'error',
			reason: 'invalid',
			httpStatus: 200
		});
	});

	it('si el proveedor no responde dentro del tiempo del intento, es timeout', async () => {
		mock.scenario('timeout');

		expect(await gateway().chat(request({ timeoutMs: 100 }))).toEqual({
			status: 'error',
			reason: 'timeout',
			httpStatus: null
		});
	});

	it('si el cliente se va, la llamada se aborta y se devuelve aborted', async () => {
		mock.scenario('timeout');
		const controller = new AbortController();
		const pending = gateway().chat(request({ signal: controller.signal, timeoutMs: 5_000 }));
		controller.abort();

		expect(await pending).toEqual({ status: 'error', reason: 'aborted', httpStatus: null });
	});

	it('una moderación del proveedor se devuelve como flagged, sin contenido', async () => {
		mock.scenario('moderation');
		const outcome = await gateway().chat(request());

		expect(outcome).toEqual({ status: 'flagged' });
		expect(JSON.stringify(outcome)).not.toContain('no-debe-llegar');
	});
});

describe('catálogo de modelos', () => {
	it('convierte los precios por token a µUSD por millón de tokens, redondeando hacia arriba', async () => {
		const models = await gateway().listModels(new AbortController().signal);

		expect(mock.requests.at(-1)?.path).toBe(MODELS_PATH);
		expect(models).toEqual([
			expect.objectContaining({
				id: 'mistralai/mistral-small',
				inputPerMTokMicroUsd: 200_000,
				outputPerMTokMicroUsd: 600_000,
				inputModalities: ['text'],
				supportedParameters: ['max_tokens', 'temperature', 'response_format', 'tools']
			}),
			expect.objectContaining({ id: 'openai/gpt-image', inputPerMTokMicroUsd: 250_000 })
		]);
	});

	it('[BE-FR-77/CA3] pide el catálogo con todas las salidas y guarda las modalidades de entrada y de salida con los parámetros de cada modelo', async () => {
		const models = await gateway().listModels(new AbortController().signal);

		expect(mock.requests.at(-1)?.query).toBe('?output_modalities=all');
		expect(models?.[0]).toMatchObject({
			inputModalities: ['text'],
			outputModalities: ['text'],
			supportedParameters: ['max_tokens', 'temperature', 'response_format', 'tools']
		});
	});

	it('si el catálogo no responde, devuelve null', async () => {
		const down = createOpenRouterGateway({
			baseUrl: 'http://127.0.0.1:9',
			apiKey: KEY
		});

		expect(await down.listModels(new AbortController().signal)).toBeNull();
	});
});

describe('conversiones de precio', () => {
	it('usdToMicroUsd no suma un micro por el ruido de coma flotante', () => {
		expect(usdToMicroUsd(0.000001)).toBe(1);
		expect(usdToMicroUsd(0.0004)).toBe(400);
		expect(usdToMicroUsd(0.0000011)).toBe(2);
	});

	it('perTokenToPerMTokMicroUsd rechaza precios no numéricos o negativos', () => {
		expect(perTokenToPerMTokMicroUsd('0.0000002')).toBe(200_000);
		expect(perTokenToPerMTokMicroUsd('abc')).toBeNull();
		expect(perTokenToPerMTokMicroUsd('-1')).toBeNull();
	});
});
