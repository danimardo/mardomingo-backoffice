// Imagen (E09) contra SQLite real y el doble de OpenRouter (T186; BE-FR-35, BE-FR-36, BE-FR-38 CA2). La imagen vuelve como
// _data URL_ y no se guarda: ni la URL ni los bytes aparecen en ninguna tabla. Mismas reglas de cobro y cancelación que el
// chat.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateSetting } from '$lib/server/features/apps';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { chargeFor } from '$lib/server/features/pricing';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { IMAGE_KEY, mediaFixture, type MediaFixture } from '../../../../../tests/builders/media';
import { runImage } from './media';
import { aiOperations } from './schema';

const IMAGE_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
/** Coste de 0,0004 USD de la respuesta simulada (400 µUSD) con los valores por defecto. */
const RESPONSE_USD = 400;

let f: MediaFixture;

beforeEach(async () => {
	f = await mediaFixture();
});

afterEach(() => {
	f.close();
});

describe('imagen (E09)', () => {
	it('en modo libre devuelve la imagen como data URL, la cobra y pide la salida de imagen al modelo', async () => {
		f.chat.gateway.answerNext({ ...FAKE_OK, imageDataUrl: IMAGE_URL });
		const expected = chargeFor(f.chat.deps.pricing, {
			appId: SEEDED_APP_ID,
			operationKey: IMAGE_KEY,
			costMicroUsd: RESPONSE_USD,
			provider: 'openrouter'
		}).chargeMicro;

		const result = await runImage(f.chat.deps, f.chat.context(), {
			operation: IMAGE_KEY,
			prompt: 'Un gato azul'
		});

		expect(result).toMatchObject({ imageDataUrl: IMAGE_URL, chargedMicro: expected });
		expect(f.chat.gateway.chatCalls.at(-1)?.modalities).toEqual(['image']);
		expect(f.chat.base.db.select().from(aiOperations).all()).toEqual([
			expect.objectContaining({ status: 'ok', chargedMicro: expected })
		]);
	});

	it('[BE-FR-81/CA1] [BE-FR-78/CA4] la imagen no se guarda: ni la data URL ni sus bytes aparecen en ninguna tabla ni en los eventos', async () => {
		f.chat.gateway.answerNext({ ...FAKE_OK, imageDataUrl: IMAGE_URL });

		await runImage(f.chat.deps, f.chat.context(), { operation: IMAGE_KEY, prompt: 'Un gato' });

		const sqlite = f.chat.base.database.sqlite;
		const names = sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.pluck()
			.all()
			.map(String);
		const everything = names
			.map((name) => JSON.stringify(sqlite.prepare(`SELECT * FROM "${name}"`).all()))
			.join('\n');
		expect(everything).not.toContain('data:image');
		expect(everything).not.toContain('iVBORw0KGgo');
		expect(JSON.stringify(f.chat.base.logger.events)).not.toContain('iVBORw0KGgo');
	});

	it('sin imagen en la respuesta, PROVIDER_ERROR sin cobro y con la reserva liberada', async () => {
		f.chat.gateway.answerNext({ ...FAKE_OK, imageDataUrl: null });

		await expect(
			runImage(f.chat.deps, f.chat.context(), { operation: IMAGE_KEY, prompt: 'Un gato' })
		).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
		expect(f.chat.base.credits.getBalance(f.chat.userId)).toMatchObject({
			totalMicro: 1_000_000_000,
			reservedMicro: 0
		});
		expect(eventsNamed(f.chat.base.logger, 'ai.provider.invalid_response')).toHaveLength(1);
	});

	it('en modo libre no se admiten variables, y sin prompt se pide el campo', async () => {
		await expect(
			runImage(f.chat.deps, f.chat.context(), {
				operation: IMAGE_KEY,
				prompt: 'x',
				variables: { a: 'b' }
			})
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'variables' } });
		await expect(
			runImage(f.chat.deps, f.chat.context(), { operation: IMAGE_KEY })
		).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			details: { field: 'prompt' }
		});
		expect(f.chat.gateway.chatCalls).toHaveLength(0);
	});

	it('un coste estimado por encima del tope de la operación se rechaza sin llamar al proveedor', async () => {
		f.setMaxCost(IMAGE_KEY, 1_000_000);

		await expect(
			runImage(f.chat.deps, f.chat.context(), { operation: IMAGE_KEY, prompt: 'Un gato' })
		).rejects.toMatchObject({ code: 'OPERATION_TOO_EXPENSIVE' });
		expect(f.chat.gateway.chatCalls).toHaveLength(0);
	});

	it('[BE-FR-37/CA1] si el cliente se va durante la generación, se cancela sin cobro', async () => {
		f.chat.gateway.holdNext();
		const controller = new AbortController();
		const pending = runImage(f.chat.deps, f.chat.context({ signal: controller.signal }), {
			operation: IMAGE_KEY,
			prompt: 'Un gato'
		});
		controller.abort();

		expect(await pending).toBeNull();
		expect(f.chat.base.credits.getBalance(f.chat.userId).reservedMicro).toBe(0);
		expect(f.chat.base.db.select().from(aiOperations).all()).toEqual([
			expect.objectContaining({ status: 'cancelled', chargedMicro: 0 })
		]);
	});
});

describe('imagen con el tope diario agotado (FR-022, BE-FR-11.6)', () => {
	it('responde 402 DAILY_FREE_LIMIT_REACHED y no llama al modelo ni deja reserva', async () => {
		const adminId = f.chat.base.addUser('adm_tope', 'admin');
		updateSetting(f.chat.deps.apps, {
			actorId: adminId,
			key: 'daily_cap_no_purchase',
			value: 1,
			reason: 'prueba del tope diario'
		});

		await expect(
			runImage(f.chat.deps, f.chat.context(), { operation: IMAGE_KEY, prompt: 'Un gato' })
		).rejects.toMatchObject({ code: 'DAILY_FREE_LIMIT_REACHED', status: 402 });
		expect(f.chat.gateway.chatCalls).toHaveLength(0);
		expect(f.chat.base.credits.getBalance(f.chat.userId).reservedMicro).toBe(0);
	});
});
