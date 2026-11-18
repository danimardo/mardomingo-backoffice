// Orden de idempotencia, validación y frecuencia en `/ai/*` (C-39; contracts/api-v1 1.8: 10 idempotencia, 11 validación,
// 12 frecuencia y concurrencia). Un reintento con la misma `Idempotency-Key` (lo que BE-FR-81 pide a las apps tras un corte)
// responde `DUPLICATE_REQUEST` sin gastar cupo, y una petición que no pasa la validación tampoco lo gasta. La ranura de
// concurrencia de las transcripciones se libera en todos los caminos.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { chatBody, chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import {
	IMAGE_KEY,
	TRANSCRIPTION_KEY,
	mediaFixture,
	type MediaFixture
} from '../../../../../tests/builders/media';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { runImage, runTranscription } from './media';
import { runChat } from './service';

const KEY = '7b0f3a52-4c1d-4e8a-9b6f-2d5e8c1a9f30';
/** `ai_requests_per_minute` sembrado: 30. */
const PER_MINUTE = 30;
const IMAGE_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('[C-39] chat: la frecuencia se cuenta después de la idempotencia y la validación', () => {
	let f: ChatFixture;

	beforeEach(() => {
		f = chatFixture();
	});

	afterEach(() => {
		f.close();
	});

	it('los reintentos con una clave ya entregada responden DUPLICATE_REQUEST y no gastan cupo', async () => {
		await runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());

		for (let index = 0; index < PER_MINUTE; index += 1) {
			await expect(
				runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody())
			).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
		}

		expect(await runChat(f.deps, f.context(), chatBody())).not.toBeNull();
	});

	it('una operación inexistente responde VALIDATION_ERROR y no gasta cupo', async () => {
		for (let index = 0; index < PER_MINUTE; index += 1) {
			await expect(
				runChat(f.deps, f.context(), chatBody({ operation: 'no-existe' }))
			).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
		}

		expect(await runChat(f.deps, f.context(), chatBody())).not.toBeNull();
	});

	it('la frecuencia sigue limitando las peticiones válidas', async () => {
		for (let index = 0; index < PER_MINUTE; index += 1) {
			await runChat(f.deps, f.context(), chatBody());
		}

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'RATE_LIMITED'
		});
	});
});

describe('[C-39] imagen y transcripción: el mismo orden, y la ranura se libera siempre', () => {
	let f: MediaFixture;

	beforeEach(async () => {
		f = await mediaFixture();
	});

	afterEach(() => {
		f.close();
	});

	const slotsInFlight = () => f.chat.deps.protections.slots.inFlight(f.chat.userId, SEEDED_APP_ID);

	it('imagen: los reintentos con una clave ya entregada no gastan cupo', async () => {
		const image = { operation: IMAGE_KEY, prompt: 'Un gato' };
		f.chat.gateway.answerNext({ ...FAKE_OK, imageDataUrl: IMAGE_URL });
		await runImage(f.chat.deps, f.chat.context({ idempotencyKey: KEY }), image);

		for (let index = 0; index < PER_MINUTE; index += 1) {
			await expect(
				runImage(f.chat.deps, f.chat.context({ idempotencyKey: KEY }), image)
			).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
		}

		f.chat.gateway.answerNext({ ...FAKE_OK, imageDataUrl: IMAGE_URL });
		expect(await runImage(f.chat.deps, f.chat.context(), image)).not.toBeNull();
	});

	it('transcripción: los reintentos con una clave ya entregada no gastan cupo ni dejan ranura ocupada', async () => {
		const audio = await f.audio('corto.webm');
		await runTranscription(f.chat.deps, f.media, f.chat.context({ idempotencyKey: KEY }), {
			operation: TRANSCRIPTION_KEY,
			audio
		});

		for (let index = 0; index < PER_MINUTE; index += 1) {
			await expect(
				runTranscription(f.chat.deps, f.media, f.chat.context({ idempotencyKey: KEY }), {
					operation: TRANSCRIPTION_KEY,
					audio
				})
			).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
		}

		expect(slotsInFlight()).toEqual({ account: 0, app: 0 });
		expect(
			await runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio
			})
		).not.toBeNull();
		expect(slotsInFlight()).toEqual({ account: 0, app: 0 });
	});

	it('transcripción: un audio demasiado largo (validación) no gasta cupo ni deja ranura ocupada', async () => {
		const audio = await f.audio('largo.webm');
		for (let index = 0; index < PER_MINUTE; index += 1) {
			f.prober.answerNext({ status: 'ok', durationSeconds: 900 });
			await expect(
				runTranscription(f.chat.deps, f.media, f.chat.context(), {
					operation: TRANSCRIPTION_KEY,
					audio
				})
			).rejects.toMatchObject({ code: 'AUDIO_TOO_LONG' });
		}

		expect(slotsInFlight()).toEqual({ account: 0, app: 0 });
		expect(
			await runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			})
		).not.toBeNull();
	});

	it('transcripción: una ranura conseguida se libera también si la petición falla después', async () => {
		f.setMaxCost(TRANSCRIPTION_KEY, 1);

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			})
		).rejects.toMatchObject({ code: 'OPERATION_TOO_EXPENSIVE' });

		expect(slotsInFlight()).toEqual({ account: 0, app: 0 });
	});
});
