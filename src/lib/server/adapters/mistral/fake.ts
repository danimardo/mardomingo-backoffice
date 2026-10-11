// Doble de Voxtral para pruebas (T181). Como el doble de OpenRouter: una llamada responde con el resultado previsto o
// queda retenida hasta que el test la resuelve; una retenida se aborta si su señal se aborta (D-05).
import type { TranscribeOutcome, TranscribeRequest, Transcriber } from './transcriber';

export interface FakeTranscriber extends Transcriber {
	readonly calls: TranscribeRequest[];
	/** Resultado de la próxima llamada no retenida. Por defecto, una transcripción de 12 s. */
	answerNext(outcome: TranscribeOutcome): void;
	/** La próxima llamada queda retenida hasta que el test la resuelve o se aborta. */
	holdNext(): void;
	/** Llamadas retenidas, pendientes de resolver. */
	readonly held: {
		readonly request: TranscribeRequest;
		resolve(outcome: TranscribeOutcome): void;
	}[];
}

export const FAKE_TRANSCRIPTION: Extract<TranscribeOutcome, { status: 'ok' }> = Object.freeze({
	status: 'ok',
	text: 'Transcripción simulada',
	audioSeconds: 12
});

const ABORTED: TranscribeOutcome = Object.freeze({
	status: 'error',
	reason: 'aborted',
	httpStatus: null
});

export function createFakeTranscriber(): FakeTranscriber {
	const queue: TranscribeOutcome[] = [];
	const calls: TranscribeRequest[] = [];
	const held: FakeTranscriber['held'][number][] = [];
	let holdNextCall = false;

	return {
		calls,
		held,
		transcribe(request: TranscribeRequest): Promise<TranscribeOutcome> {
			calls.push(request);
			if (request.signal.aborted) return Promise.resolve(ABORTED);
			if (holdNextCall) {
				holdNextCall = false;
				return new Promise((resolve) => {
					held.push({ request, resolve });
					request.signal.addEventListener('abort', () => {
						resolve(ABORTED);
					});
				});
			}
			return Promise.resolve(queue.shift() ?? FAKE_TRANSCRIPTION);
		},
		answerNext(outcome: TranscribeOutcome): void {
			queue.push(outcome);
		},
		holdNext(): void {
			holdNextCall = true;
		}
	};
}
