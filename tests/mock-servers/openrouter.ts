// Simulador de OpenRouter (Historias 15.10, 15.23; T158). Responde a las rutas que usa el adaptador según el escenario
// activo: `ok` (coste en `usage.cost`), `no_cost` (sin coste: se busca en `/generation`), `no_cost_no_generation`,
// `http_500`, `timeout` (responde tarde), `invalid_json`, `extra_fields`, `moderation`, `require_parameters`, `truncated`
// y `models` (catálogo con precios en cadenas). Guarda las peticiones para comprobar cabeceras y `data_collection`.
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export const CHAT_PATH = '/api/v1/chat/completions';
export const GENERATION_PATH = '/api/v1/generation';
export const MODELS_PATH = '/api/v1/models';
/** Ruta de lectura del número de llamadas de chat recibidas (para comprobar que una petición llegó al proveedor). */
export const CHAT_CALLS_PATH = '/__chat_calls';

/** Coste simulado de la respuesta `ok`: 0,0004 USD = 400 µUSD (ejemplo de api-v1 7.3: 776.480 µc). */
export const SIMULATED_COST_USD = 0.0004;
export const SIMULATED_GENERATION_COST_USD = 0.0012;

function completion(model: string, scenario: string): unknown {
	const message = { role: 'assistant', content: 'Respuesta simulada' };
	const choice = {
		index: 0,
		finish_reason: scenario === 'truncated' ? 'length' : 'stop',
		message
	};
	const usage: Record<string, unknown> = {
		prompt_tokens: 100,
		completion_tokens: 50,
		total_tokens: 150
	};
	if (scenario !== 'no_cost' && scenario !== 'no_cost_no_generation')
		usage.cost = SIMULATED_COST_USD;
	const body: Record<string, unknown> = {
		id: 'gen-simulada-1',
		model,
		provider: 'Mistral',
		choices: [choice],
		usage
	};
	if (scenario === 'extra_fields')
		body.unexpected_debug = { internal: 'no debe llegar al cliente' };
	return body;
}

function modelsCatalog(): unknown {
	return {
		data: [
			{
				id: 'mistralai/mistral-small',
				pricing: { prompt: '0.0000002', completion: '0.0000006' },
				architecture: { input_modalities: ['text'], output_modalities: ['text'] },
				supported_parameters: ['max_tokens', 'temperature', 'response_format', 'tools']
			},
			{
				id: 'openai/gpt-image',
				pricing: { prompt: '0.00000025', completion: '0.000001' },
				architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
				supported_parameters: ['max_tokens']
			}
		]
	};
}

export function startOpenRouterMock(): Promise<MockServer> {
	let chatCalls = 0;
	return startMockServer((request: MockRequest): MockReply => {
		const scenario = request.scenario;
		if (request.method === 'GET' && request.path === CHAT_CALLS_PATH) {
			return { status: 200, body: chatCalls };
		}
		if (request.method === 'GET' && request.path === MODELS_PATH) {
			return { status: 200, body: modelsCatalog() };
		}
		if (request.method === 'GET' && request.path === GENERATION_PATH) {
			if (scenario === 'no_cost_no_generation') return { status: 404 };
			return { status: 200, body: { data: { total_cost: SIMULATED_GENERATION_COST_USD } } };
		}
		if (request.method !== 'POST' || request.path !== CHAT_PATH) return { status: 404 };
		chatCalls += 1;

		const model = modelOf(request.body);
		switch (scenario) {
			case 'http_500':
				return { status: 500, body: { error: { code: 500, message: 'interno del proveedor' } } };
			case 'timeout':
				return { status: 200, body: completion(model, 'ok'), delayMs: 5_000 };
			case 'invalid_json':
				return { status: 200, text: '{"id": "truncado', contentType: 'application/json' };
			case 'moderation':
				return {
					status: 403,
					body: {
						error: {
							code: 403,
							message: 'Entrada rechazada por moderación',
							metadata: { flagged_input: 'texto-moderado-no-debe-llegar' }
						}
					}
				};
			case 'require_parameters':
				return {
					status: 404,
					body: { error: { code: 404, message: 'Ningún proveedor admite los parámetros pedidos' } }
				};
			default:
				return { status: 200, body: completion(model, scenario) };
		}
	});
}

function modelOf(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			'model' in parsed &&
			typeof parsed.model === 'string'
		) {
			return parsed.model;
		}
	} catch {
		// Cuerpo no JSON: el simulador responde con el modelo por defecto.
	}
	return 'mistralai/mistral-small';
}
