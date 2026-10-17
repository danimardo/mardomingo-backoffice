// Adaptador de ffmpeg (T182): conversión real con `execFile` contra un simulador en node, en un directorio temporal. Se
// comprueba la copia correcta, el fallo de un archivo ilegible, el tiempo máximo con SIGKILL y la cancelación.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFfmpeg } from './converter';

const STUB = fileURLToPath(
	new URL('../../../../../tests/fixtures/bin/ffmpeg-stub.mjs', import.meta.url)
);
const stubbed = createFfmpeg({ binary: process.execPath, prefixArgs: [STUB] });
const idle = () => new AbortController().signal;

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ffmpeg-prueba-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('createFfmpeg (ejecución real contra el simulador)', () => {
	it('convierte la entrada a la salida del mismo directorio', async () => {
		const input = join(dir, 'nota.webm');
		const output = join(dir, 'nota.mp3');
		await writeFile(input, Buffer.from('webm-original'));

		const outcome = await stubbed.convert(input, output, {
			format: 'mp3',
			timeoutMs: 5_000,
			signal: idle()
		});

		expect(outcome).toEqual({ status: 'ok', outputPath: output });
		expect((await readFile(output)).toString()).toBe('webm-original');
	});

	it('un archivo ilegible falla sin salida', async () => {
		const input = join(dir, 'corrupt.webm');
		const outcome = await stubbed.convert(input, join(dir, 'x.wav'), {
			format: 'wav',
			timeoutMs: 5_000,
			signal: idle()
		});

		expect(outcome).toEqual({ status: 'failed' });
	});

	it('si excede el tiempo máximo, se mata el proceso y devuelve timeout', async () => {
		const outcome = await stubbed.convert(join(dir, 'sleep.webm'), join(dir, 'x.mp3'), {
			format: 'mp3',
			timeoutMs: 300,
			signal: idle()
		});

		expect(outcome).toEqual({ status: 'timeout' });
	});

	it('si ya está cancelado, devuelve aborted sin ejecutar', async () => {
		const controller = new AbortController();
		controller.abort();
		expect(
			await stubbed.convert(join(dir, 'a.webm'), join(dir, 'a.mp3'), {
				format: 'mp3',
				timeoutMs: 5_000,
				signal: controller.signal
			})
		).toEqual({ status: 'aborted' });
	});
});
