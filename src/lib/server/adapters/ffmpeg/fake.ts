// Doble de ffmpeg para pruebas (T182): escribe en la salida unos bytes fijos (sin ejecutar nada), o devuelve el resultado
// previsto. Así el servicio puede leer el convertido de disco sin depender del binario.
import { writeFile } from 'node:fs/promises';
import type { ConvertOutcome, Converter } from './converter';

export interface FakeConverter extends Converter {
	readonly calls: { readonly inputPath: string; readonly outputPath: string }[];
	answerNext(outcome: ConvertOutcome): void;
}

export const CONVERTED_BYTES = Buffer.from('audio-convertido-simulado');

export function createFakeConverter(): FakeConverter {
	const queue: ConvertOutcome[] = [];
	const calls: { inputPath: string; outputPath: string }[] = [];
	return {
		calls,
		async convert(inputPath, outputPath, { signal }) {
			calls.push({ inputPath, outputPath });
			if (signal.aborted) return { status: 'aborted' };
			const next = queue.shift();
			if (next !== undefined) return next;
			await writeFile(outputPath, CONVERTED_BYTES);
			return { status: 'ok', outputPath };
		},
		answerNext(outcome) {
			queue.push(outcome);
		}
	};
}
