// Simulador de Voxtral (Historias 15.10, 15.23; T158, T181). Responde a `POST /v1/audio/transcriptions` según el escenario
// activo: `ok` (texto y `usage.prompt_audio_seconds`), `http_500` (fallo técnico), `timeout` (responde tarde),
// `billing_401`, `billing_402`, `billing_429` (facturación) e `invalid_json`. Guarda las peticiones en `/__calls`.
import { startMockServer, type MockReply, type MockRequest, type MockServer } from './server';

export const TRANSCRIPTIONS_PATH = '/v1/audio/transcriptions';
/** Número de transcripciones recibidas, para comprobar que una petición llegó al proveedor. */
export const TRANSCRIPTION_CALLS_PATH = '/__calls';
/** Segundos de audio que informa el simulador en el escenario `ok`. */
export const SIMULATED_AUDIO_SECONDS = 12;

export function startMistralMock(): Promise<MockServer> {
	let calls = 0;
	return startMockServer((request: MockRequest): MockReply => {
		if (request.method === 'GET' && request.path === TRANSCRIPTION_CALLS_PATH) {
			return { status: 200, body: calls };
		}
		if (request.method !== 'POST' || request.path !== TRANSCRIPTIONS_PATH) return { status: 404 };
		calls += 1;
		switch (request.scenario) {
			case 'http_500':
				return { status: 500, body: { message: 'interno del proveedor' } };
			case 'timeout':
				return { status: 200, body: transcription(), delayMs: 5_000 };
			case 'billing_401':
				return { status: 401, body: { message: 'clave no válida' } };
			case 'billing_402':
				return { status: 402, body: { message: 'saldo agotado' } };
			case 'billing_429':
				return { status: 429, body: { message: 'límite alcanzado' } };
			case 'invalid_json':
				return { status: 200, text: '{"text": "trunc', contentType: 'application/json' };
			default:
				return { status: 200, body: transcription() };
		}
	});
}

function transcription(): unknown {
	return {
		model: 'voxtral-mini-latest',
		text: 'Transcripción simulada',
		language: 'es',
		usage: { prompt_audio_seconds: SIMULATED_AUDIO_SECONDS }
	};
}
