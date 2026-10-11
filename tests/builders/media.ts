// Constructor de pruebas de transcripción e imagen (T173, T186): sobre el constructor de chat, activa las operaciones de
// transcripción e imagen, pone un directorio temporal propio por prueba (para comprobar que no queda nada) y dobles de
// Voxtral, ffprobe y ffmpeg. Los reintentos del principal se acortan salvo que la prueba los pruebe con temporizador.
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { createFakeProber, type FakeProber } from '$lib/server/adapters/ffprobe/fake';
import { createFakeConverter, type FakeConverter } from '$lib/server/adapters/ffmpeg/fake';
import { createFakeTranscriber, type FakeTranscriber } from '$lib/server/adapters/mistral/fake';
import type { MediaDeps, AudioUpload } from '$lib/server/features/ai/media';
import { appOperations } from '$lib/server/features/apps/schema';
import { toMicro } from '$lib/shared/money';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';
import { chatFixture, type ChatFixture } from './chat';
import { fileURLToPath } from 'node:url';

export const TRANSCRIPTION_KEY = 'transcription';
export const IMAGE_KEY = 'image-generation';

export interface MediaFixture {
	readonly chat: ChatFixture;
	readonly media: MediaDeps;
	readonly prober: FakeProber;
	readonly converter: FakeConverter;
	readonly transcriber: FakeTranscriber;
	readonly tempRoot: string;
	/** Audio de `tests/fixtures/audio/`, como lo recibe la ruta. */
	audio(name: string): Promise<AudioUpload>;
	/** Pone el tope de coste de una operación (µc). */
	setMaxCost(key: string, micro: number): void;
	close(): void;
}

/** Activa una operación sembrada (las activa el administrador en L13; aquí es una precondición de la prueba). */
function activate(chat: ChatFixture, key: string): void {
	chat.base.db
		.update(appOperations)
		.set({ active: true })
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, key)))
		.run();
}

export async function mediaFixture(): Promise<MediaFixture> {
	const chat = chatFixture();
	activate(chat, TRANSCRIPTION_KEY);
	activate(chat, IMAGE_KEY);
	// Con los valores aprobados (T079), 80.000 µUSD por imagen equivalen a ~155 créditos con la comisión, el tipo y el margen
	// por defecto, y el tope de la operación es de 80. Toda imagen se rechazaría con OPERATION_TOO_EXPENSIVE. Aquí se sube
	// el tope para probar el flujo; el hallazgo queda en el informe para decisión del propietario.
	chat.base.db
		.update(appOperations)
		.set({ maxCostMicro: toMicro(200_000_000) })
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, IMAGE_KEY)))
		.run();
	const tempRoot = await mkdtemp(join(tmpdir(), 'ai-prueba-'));
	const prober = createFakeProber();
	const converter = createFakeConverter();
	const transcriber = createFakeTranscriber();
	const media: MediaDeps = { transcriber, prober, converter, tempRoot };
	const audioDir = fileURLToPath(new URL('../fixtures/audio/', import.meta.url));

	return {
		chat,
		media,
		prober,
		converter,
		transcriber,
		tempRoot,
		async audio(name) {
			const bytes = new Uint8Array(await readFile(join(audioDir, name)));
			return { bytes, name, mimeType: 'audio/webm' };
		},
		setMaxCost(key, micro) {
			chat.base.db
				.update(appOperations)
				.set({ maxCostMicro: toMicro(micro) })
				.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, key)))
				.run();
		},
		close() {
			chat.close();
		}
	};
}
