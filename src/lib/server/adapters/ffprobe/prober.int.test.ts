// Adaptador de ffprobe (T182): análisis de la salida y ejecución real con `execFile` contra un simulador en node. Se
// comprueba la duración de cabecera, la reconstrucción desde los paquetes (WebM sin N/A), el tiempo máximo con SIGKILL,
// la cancelación y el fallo de un archivo ilegible. El binario real queda pendiente de verificar (ver informe).
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFfprobe, durationOf } from './prober';

const STUB = fileURLToPath(
	new URL('../../../../../tests/fixtures/bin/ffprobe-stub.mjs', import.meta.url)
);
const stubbed = createFfprobe({ binary: process.execPath, prefixArgs: [STUB] });
const idle = () => new AbortController().signal;

describe('durationOf', () => {
	it('usa la duración de la cabecera cuando viene', () => {
		expect(durationOf('{"format":{"duration":"4.250000"}}')).toEqual({
			status: 'ok',
			durationSeconds: 4.25
		});
	});

	it('si la cabecera trae N/A, usa el final del último paquete de audio', () => {
		const json =
			'{"format":{"duration":"N/A"},"packets":[{"pts_time":"0","duration_time":"1"},{"pts_time":"1","duration_time":"2.5"}]}';
		expect(durationOf(json)).toEqual({ status: 'ok', durationSeconds: 3.5 });
	});

	it('ignora paquetes sin marca de tiempo válida', () => {
		expect(
			durationOf('{"packets":[{"pts_time":"N/A"},{"pts_time":"2","duration_time":"1"}]}')
		).toEqual({
			status: 'ok',
			durationSeconds: 3
		});
	});

	it('sin duración en ningún sitio, o con JSON que no encaja, es ilegible', () => {
		expect(durationOf('{"format":{"duration":"N/A"}}')).toEqual({ status: 'unreadable' });
		expect(durationOf('{"format":{"duration":"0"}}')).toEqual({ status: 'unreadable' });
		expect(durationOf('no es json')).toEqual({ status: 'unreadable' });
		expect(durationOf('{"format":{"duration":5}}')).toEqual({ status: 'unreadable' });
	});
});

describe('createFfprobe (ejecución real contra el simulador)', () => {
	it('lee la duración de la cabecera del archivo', async () => {
		expect(await stubbed.probe('audio.webm', { timeoutMs: 5_000, signal: idle() })).toEqual({
			status: 'ok',
			durationSeconds: 3.5
		});
	});

	it('reconstruye la duración desde los paquetes cuando la cabecera no la trae', async () => {
		expect(await stubbed.probe('packets.webm', { timeoutMs: 5_000, signal: idle() })).toEqual({
			status: 'ok',
			durationSeconds: 3.5
		});
	});

	it('un archivo ilegible devuelve unreadable', async () => {
		expect(await stubbed.probe('corrupt.webm', { timeoutMs: 5_000, signal: idle() })).toEqual({
			status: 'unreadable'
		});
	});

	it('si excede el tiempo máximo, se mata el proceso y devuelve timeout', async () => {
		expect(await stubbed.probe('sleep.webm', { timeoutMs: 300, signal: idle() })).toEqual({
			status: 'timeout'
		});
	});

	it('si ya está cancelado no lanza nada y devuelve aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		expect(
			await stubbed.probe('audio.webm', { timeoutMs: 5_000, signal: controller.signal })
		).toEqual({
			status: 'aborted'
		});
	});

	it('si se cancela mientras se ejecuta, devuelve aborted', async () => {
		const controller = new AbortController();
		const pending = stubbed.probe('sleep.webm', { timeoutMs: 10_000, signal: controller.signal });
		setTimeout(() => {
			controller.abort();
		}, 200);
		expect(await pending).toEqual({ status: 'aborted' });
	});
});
