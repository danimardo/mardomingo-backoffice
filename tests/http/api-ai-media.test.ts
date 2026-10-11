// Transcripción (E08) e imagen (E09) contra el build, con ffprobe y ffmpeg reales y los simuladores de Voxtral y de OpenRouter
// (api-v1 E08, E09; T187; BE-FR-35, BE-FR-44, FR-070, D-01). Las pruebas comparten la cuenta de chat sembrada y van en serie.
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { send } from './client';
import { silentWav } from '../builders/audio';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const openrouterUrl = inject('openrouterMockUrl');
const mistralUrl = inject('mistralMockUrl');
const apiHost = new URL(baseUrl).host;

const BOUNDARY = `frontera-${randomBytes(6).toString('hex')}`;
const bearer = {
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${token}`
};

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

/** Cuerpo multipart con `operation` y `file`, como lo envía el cliente de E08. */
function multipart(
	operation: string,
	file: Uint8Array | null,
	fileName = 'nota.wav',
	mime = 'audio/wav'
): Uint8Array {
	const parts: Buffer[] = [
		Buffer.from(
			`--${BOUNDARY}\r\nContent-Disposition: form-data; name="operation"\r\n\r\n${operation}\r\n`
		)
	];
	if (file !== null) {
		parts.push(
			Buffer.from(
				`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`
			),
			Buffer.from(file),
			Buffer.from('\r\n')
		);
	}
	parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
	return new Uint8Array(Buffer.concat(parts));
}

const multipartHeaders = {
	...bearer,
	'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
	accept: 'application/json'
};

function scenario(url: string, name: string): Promise<unknown> {
	return send(url, '/__scenario', { method: 'POST', body: name });
}

async function transcribe(
	operation: string,
	file: Uint8Array | null,
	fileName?: string,
	mime?: string
) {
	return send(baseUrl, '/api/v1/ai/transcribe', {
		method: 'POST',
		host: apiHost,
		headers: multipartHeaders,
		body: multipart(operation, file, fileName, mime)
	});
}

afterEach(async () => {
	await scenario(mistralUrl, 'ok');
	await scenario(openrouterUrl, 'ok');
});

describe('POST /api/v1/ai/transcribe', () => {
	it('un audio WAV se transcribe con Voxtral y responde el texto, el proveedor usado y el saldo, sin modelo', async () => {
		const result = await transcribe('transcription', silentWav(2));

		expect(result.status).toBe(200);
		const response = parse(result.text);
		expect(response).toMatchObject({
			text: 'Transcripción simulada',
			providerUsed: 'primary',
			audioSeconds: 12
		});
		expect(response.chargedMicro).toBeGreaterThan(0);
		expect(response).not.toHaveProperty('model');
		expect(result.text).not.toContain('voxtral');
	});

	it('un fichero que no es audio legible responde 400 VALIDATION_ERROR en file, sin cobro', async () => {
		const result = await transcribe(
			'transcription',
			new TextEncoder().encode('esto no es audio'),
			'nota.webm',
			'audio/webm'
		);

		expect(result.status).toBe(400);
		expect(errorOf(result.text)).toEqual({ code: 'VALIDATION_ERROR', details: { field: 'file' } });
	});

	it('sin fichero, responde 400 VALIDATION_ERROR en file', async () => {
		const result = await transcribe('transcription', null);

		expect(result.status).toBe(400);
		expect(errorOf(result.text).code).toBe('VALIDATION_ERROR');
	});

	it('un audio más largo que max_audio_seconds más la tolerancia responde 413 AUDIO_TOO_LONG con el máximo', async () => {
		const result = await transcribe('transcription', silentWav(320));

		expect(result.status).toBe(413);
		expect(errorOf(result.text)).toEqual({ code: 'AUDIO_TOO_LONG', details: { maxSeconds: 300 } });
	});

	it('si Voxtral y el respaldo fallan, responde 502 TRANSCRIPTION_FAILED con sus motivos, sin mensajes del proveedor', async () => {
		await scenario(mistralUrl, 'http_500');
		await scenario(openrouterUrl, 'http_500');

		const result = await transcribe('transcription', silentWav(2));

		expect(result.status).toBe(502);
		expect(errorOf(result.text)).toEqual({
			code: 'TRANSCRIPTION_FAILED',
			details: { primaryError: 'http', backupError: 'http' }
		});
		expect(result.text).not.toContain('interno del proveedor');
	});

	it('si Voxtral falla y el respaldo responde, se entrega con providerUsed backup', async () => {
		await scenario(mistralUrl, 'http_500');

		const result = await transcribe('transcription', silentWav(2));

		expect(result.status).toBe(200);
		expect(parse(result.text)).toMatchObject({ providerUsed: 'backup' });
	});

	it('un fichero por encima de la subida máxima se rechaza antes de procesarlo', async () => {
		const tooBig = new Uint8Array(10 * 1024 * 1024 + 1);

		const result = await transcribe('transcription', tooBig);

		expect(result.status).toBe(413);
	});
});

describe('POST /api/v1/ai/image', () => {
	it('en modo libre devuelve la imagen como data URL y no la guarda', async () => {
		await scenario(openrouterUrl, 'image');

		const result = await send(baseUrl, '/api/v1/ai/image', {
			method: 'POST',
			host: apiHost,
			headers: { ...bearer, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ operation: 'image-generation', prompt: 'Un faro al amanecer' })
		});

		expect(result.status).toBe(200);
		const response = parse(result.text);
		expect(response.imageDataUrl).toMatch(/^data:image\/png;base64,/);
		expect(response).not.toHaveProperty('model');
	});

	it('si el modelo no devuelve imagen, responde 502 PROVIDER_ERROR', async () => {
		const result = await send(baseUrl, '/api/v1/ai/image', {
			method: 'POST',
			host: apiHost,
			headers: { ...bearer, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ operation: 'image-generation', prompt: 'Un faro' })
		});

		expect(result.status).toBe(502);
		expect(errorOf(result.text).code).toBe('PROVIDER_ERROR');
	});
});
