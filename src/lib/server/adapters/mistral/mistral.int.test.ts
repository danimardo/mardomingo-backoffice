// Adaptador de Voxtral contra su simulador HTTP (T181; BE-FR-35, R11). Comprueba el éxito con su modelo y su
// autorización, la clasificación de facturación (401, 402, 429) frente a los fallos técnicos, el tiempo agotado, la
// desconexión y el JSON inválido.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	startMistralMock,
	TRANSCRIPTION_CALLS_PATH,
	TRANSCRIPTIONS_PATH,
	SIMULATED_AUDIO_SECONDS
} from '../../../../../tests/mock-servers/mistral';
import { send } from '../../../../../tests/http/client';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { createMistralTranscriber, type TranscribeRequest } from './transcriber';

const KEY = 'clave-voxtral-no-real';
let mock: MockServer;

beforeAll(async () => {
	mock = await startMistralMock();
});

afterAll(async () => {
	await mock.close();
});

beforeEach(async () => {
	await send(mock.url, '/__scenario', { method: 'POST', body: 'ok' });
});

function transcriber() {
	return createMistralTranscriber({ baseUrl: mock.url, apiKey: KEY });
}

function request(overrides: Partial<TranscribeRequest> = {}): TranscribeRequest {
	return {
		audio: new Uint8Array([1, 2, 3, 4]),
		fileName: 'nota.webm',
		mimeType: 'audio/webm',
		timeoutMs: 5_000,
		signal: new AbortController().signal,
		...overrides
	};
}

async function scenario(name: string): Promise<void> {
	await send(mock.url, '/__scenario', { method: 'POST', body: name });
}

describe('Voxtral', () => {
	it('transcribe con su modelo y su autorización, y devuelve el texto y los segundos facturados', async () => {
		const outcome = await transcriber().transcribe(request());

		expect(outcome).toEqual({
			status: 'ok',
			text: 'Transcripción simulada',
			audioSeconds: SIMULATED_AUDIO_SECONDS
		});
		const sent = mock.requests.at(-1);
		expect(sent?.path).toBe(TRANSCRIPTIONS_PATH);
		expect(sent?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(sent?.body).toContain('voxtral-mini-latest');
	});

	it.each([
		['billing_401', 401],
		['billing_402', 402],
		['billing_429', 429]
	])('el escenario %s es un error de facturación, con su código', async (name, status) => {
		await scenario(name);

		expect(await transcriber().transcribe(request())).toEqual({
			status: 'error',
			reason: 'billing',
			httpStatus: status
		});
	});

	it('un fallo técnico (500) es http y no de facturación; su mensaje no sale', async () => {
		await scenario('http_500');
		const outcome = await transcriber().transcribe(request());

		expect(outcome).toEqual({ status: 'error', reason: 'http', httpStatus: 500 });
		expect(JSON.stringify(outcome)).not.toContain('interno del proveedor');
	});

	it('si el proveedor no responde en el tiempo del intento, es timeout', async () => {
		await scenario('timeout');

		expect(await transcriber().transcribe(request({ timeoutMs: 100 }))).toEqual({
			status: 'error',
			reason: 'timeout',
			httpStatus: null
		});
	});

	it('si el cliente se va, la llamada se aborta', async () => {
		await scenario('timeout');
		const controller = new AbortController();
		const pending = transcriber().transcribe(
			request({ signal: controller.signal, timeoutMs: 5_000 })
		);
		controller.abort();

		expect(await pending).toEqual({ status: 'error', reason: 'aborted', httpStatus: null });
	});

	it('un cuerpo que no es JSON es inválido', async () => {
		await scenario('invalid_json');

		expect(await transcriber().transcribe(request())).toEqual({
			status: 'error',
			reason: 'invalid',
			httpStatus: 200
		});
	});

	it('cuenta las transcripciones recibidas por el simulador', async () => {
		const before = Number((await send(mock.url, TRANSCRIPTION_CALLS_PATH)).text);
		await transcriber().transcribe(request());

		expect(Number((await send(mock.url, TRANSCRIPTION_CALLS_PATH)).text)).toBe(before + 1);
	});
});
