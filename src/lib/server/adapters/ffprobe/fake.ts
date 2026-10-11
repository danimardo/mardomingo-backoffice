// Doble de ffprobe para pruebas (T182): responde con la duración prevista; por defecto, 12 s.
import type { ProbeOutcome, Prober } from './prober';

export interface FakeProber extends Prober {
	readonly paths: string[];
	answerNext(outcome: ProbeOutcome): void;
}

export function createFakeProber(): FakeProber {
	const queue: ProbeOutcome[] = [];
	const paths: string[] = [];
	return {
		paths,
		probe(path) {
			paths.push(path);
			return Promise.resolve(queue.shift() ?? { status: 'ok', durationSeconds: 12 });
		},
		answerNext(outcome) {
			queue.push(outcome);
		}
	};
}
