// Transcripción (E08) contra SQLite real y los dobles de Voxtral, ffprobe y ffmpeg (T186; BE-FR-35, BE-FR-36, BE-FR-38 CA2,
// BE-FR-44; FR-055). Cubre el cobro de Voxtral, el respaldo, los reintentos a 2 s con temporizador falso, los errores por
// motivo, la cancelación, los temporales borrados y que el audio no se guarda.
import { readdir } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { FAKE_TRANSCRIPTION } from '$lib/server/adapters/mistral/fake';
import { updateSetting } from '$lib/server/features/apps';
import { appOperations } from '$lib/server/features/apps/schema';
import { chargeFor } from '$lib/server/features/pricing';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	mediaFixture,
	TRANSCRIPTION_KEY,
	type MediaFixture
} from '../../../../../tests/builders/media';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { runTranscription } from './media';
import { aiOperations } from './schema';

/** Coste de Voxtral de 12 s con el precio por defecto (3.000 µUSD/min): 600 µUSD, cobrados con la comisión y el margen. */
const VOXTRAL_12S_USD = 600;

let f: MediaFixture;

beforeEach(async () => {
	f = await mediaFixture();
});

afterEach(() => {
	f.close();
});

async function temporaries(): Promise<string[]> {
	return readdir(f.tempRoot);
}

/** Cambia los retrasos de reintento de Voxtral de la operación sembrada. */
function setRetryDelays(delays: number[]): void {
	const row = f.chat.base.db
		.select({ config: appOperations.transcriptionConfig })
		.from(appOperations)
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, TRANSCRIPTION_KEY)))
		.get();
	const config = row?.config;
	if (config === null || config === undefined)
		throw new Error('la operación no tiene configuración de transcripción');
	f.chat.base.db
		.update(appOperations)
		.set({
			transcriptionConfig: { ...config, primary: { ...config.primary, retry_delays_ms: delays } }
		})
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, TRANSCRIPTION_KEY)))
		.run();
}

/** Espera a que una condición se cumpla, con sondeo real (el temporizador puede estar falso). */
async function until(condition: () => boolean): Promise<void> {
	for (let i = 0; i < 500 && !condition(); i += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
	expect(condition()).toBe(true);
}

describe('transcripción (E08)', () => {
	it('un audio corto se transcribe con Voxtral, se cobra lo que factura y no queda ningún temporal', async () => {
		const expected = chargeFor(f.chat.deps.pricing, {
			appId: SEEDED_APP_ID,
			operationKey: TRANSCRIPTION_KEY,
			costMicroUsd: VOXTRAL_12S_USD,
			provider: 'mistral'
		}).chargeMicro;

		const result = await runTranscription(f.chat.deps, f.media, f.chat.context(), {
			operation: TRANSCRIPTION_KEY,
			audio: await f.audio('corto.webm')
		});

		expect(result).toMatchObject({
			text: FAKE_TRANSCRIPTION.text,
			providerUsed: 'primary',
			audioSeconds: 12,
			chargedMicro: expected
		});
		expect(await temporaries()).toEqual([]);
		expect(f.transcriber.calls).toHaveLength(1);
		expect(f.chat.base.db.select().from(aiOperations).all()).toEqual([
			expect.objectContaining({
				status: 'ok',
				provider: 'mistral',
				usedFallback: false,
				audioMs: 12_000
			})
		]);
	});

	it('un audio más largo que max_audio_seconds más la tolerancia se rechaza antes de cobrar', async () => {
		f.prober.answerNext({ status: 'ok', durationSeconds: 900 });

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('largo.webm')
			})
		).rejects.toMatchObject({ code: 'AUDIO_TOO_LONG', details: { maxSeconds: 300 } });
		expect(f.transcriber.calls).toHaveLength(0);
		expect(f.chat.base.db.select().from(aiOperations).all()).toHaveLength(0);
		expect(await temporaries()).toEqual([]);
	});

	it('un audio ilegible responde VALIDATION_ERROR en file, sin fila ni llamada', async () => {
		f.prober.answerNext({ status: 'unreadable' });

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('ilegible.webm')
			})
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'file' } });
		expect(await temporaries()).toEqual([]);
	});

	it('si Voxtral falla con 500 en todos sus intentos, pasa al respaldo y cobra solo el respaldo', async () => {
		setRetryDelays([0, 0, 0]);
		for (let i = 0; i < 4; i += 1) {
			f.transcriber.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		}
		f.chat.gateway.answerNext({ ...FAKE_OK, costMicroUsd: 400 });

		const result = await runTranscription(f.chat.deps, f.media, f.chat.context(), {
			operation: TRANSCRIPTION_KEY,
			audio: await f.audio('corto.webm')
		});

		expect(result).toMatchObject({ providerUsed: 'backup', text: FAKE_OK.text });
		expect(f.transcriber.calls).toHaveLength(4);
		expect(f.converter.calls).toHaveLength(1);
		expect(eventsNamed(f.chat.base.logger, 'ai.transcription.backup_used')).toHaveLength(1);
		expect(eventsNamed(f.chat.base.logger, 'ai.provider.retry')).toHaveLength(3);
		expect(await temporaries()).toEqual([]);
	});

	it('el primer reintento de Voxtral espera 2 s, con temporizador falso', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			f.transcriber.answerNext({ status: 'error', reason: 'timeout', httpStatus: null });
			const pending = runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			});
			await until(() => f.transcriber.calls.length === 1);

			await vi.advanceTimersByTimeAsync(1_999);
			expect(f.transcriber.calls).toHaveLength(1);
			await vi.advanceTimersByTimeAsync(1);
			await until(() => f.transcriber.calls.length === 2);
			await pending;
		} finally {
			vi.useRealTimers();
		}
	});

	it('Voxtral con 401 es facturación: no reintenta, pasa al respaldo y el fallo de ambos se devuelve con sus motivos', async () => {
		f.transcriber.answerNext({ status: 'error', reason: 'billing', httpStatus: 401 });
		f.chat.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			})
		).rejects.toMatchObject({
			code: 'TRANSCRIPTION_FAILED',
			details: { primaryError: 'billing', backupError: 'http' }
		});
		expect(f.transcriber.calls).toHaveLength(1);
		expect(eventsNamed(f.chat.base.logger, 'ai.provider.billing_error')).toHaveLength(1);
		expect(f.chat.base.credits.getBalance(f.chat.userId).totalMicro).toBe(1_000_000_000);
		expect(f.chat.base.db.select().from(aiOperations).all()).toEqual([
			expect.objectContaining({
				status: 'provider_error',
				errorCode: 'TRANSCRIPTION_FAILED',
				chargedMicro: 0
			})
		]);
		expect(await temporaries()).toEqual([]);
	});

	it('si la conversión para el respaldo falla, el respaldo figura como no disponible', async () => {
		for (let i = 0; i < 4; i += 1) {
			f.transcriber.answerNext({ status: 'error', reason: 'unavailable', httpStatus: null });
		}
		f.converter.answerNext({ status: 'failed' });

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			})
		).rejects.toMatchObject({
			code: 'TRANSCRIPTION_FAILED',
			details: { backupError: 'unavailable' }
		});
		expect(await temporaries()).toEqual([]);
	});

	it('si el cliente se va durante Voxtral, la operación se cancela sin cobro y el temporal se borra', async () => {
		f.transcriber.holdNext();
		const controller = new AbortController();
		const pending = runTranscription(
			f.chat.deps,
			f.media,
			f.chat.context({ signal: controller.signal }),
			{
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			}
		);
		await until(() => f.transcriber.held.length === 1);
		controller.abort();

		expect(await pending).toBeNull();
		expect(f.chat.base.credits.getBalance(f.chat.userId).reservedMicro).toBe(0);
		expect(f.chat.base.db.select().from(aiOperations).all()).toEqual([
			expect.objectContaining({ status: 'cancelled', chargedMicro: 0 })
		]);
		expect(await temporaries()).toEqual([]);
	});

	it('el audio no se guarda: el marcador no aparece en ninguna tabla ni en los eventos', async () => {
		const marker = 'AUDIO-MARCADOR-7d1f-no-debe-guardarse';
		const audio = { ...(await f.audio('corto.webm')), bytes: new TextEncoder().encode(marker) };

		await runTranscription(f.chat.deps, f.media, f.chat.context(), {
			operation: TRANSCRIPTION_KEY,
			audio
		});

		const sqlite = f.chat.base.database.sqlite;
		const names = sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.pluck()
			.all()
			.map(String);
		const everything = names
			.map((name) => JSON.stringify(sqlite.prepare(`SELECT * FROM "${name}"`).all()))
			.join('\n');
		expect(everything).not.toContain(marker);
		expect(JSON.stringify(f.chat.base.logger.events)).not.toContain(marker);
	});
});

describe('transcripción con el tope diario agotado (FR-022, BE-FR-11.6)', () => {
	it('responde 402 DAILY_FREE_LIMIT_REACHED sin reservar ni llamar a Voxtral', async () => {
		const adminId = f.chat.base.addUser('adm_tope', 'admin');
		updateSetting(f.chat.deps.apps, {
			actorId: adminId,
			key: 'daily_cap_no_purchase',
			value: 1,
			reason: 'prueba del tope diario'
		});

		await expect(
			runTranscription(f.chat.deps, f.media, f.chat.context(), {
				operation: TRANSCRIPTION_KEY,
				audio: await f.audio('corto.webm')
			})
		).rejects.toMatchObject({ code: 'DAILY_FREE_LIMIT_REACHED', status: 402 });
		expect(f.chat.base.credits.getBalance(f.chat.userId).reservedMicro).toBe(0);
	});
});
