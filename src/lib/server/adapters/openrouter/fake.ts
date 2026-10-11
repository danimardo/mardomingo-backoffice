// Doble de OpenRouter para pruebas (T157). Una llamada de chat responde con el resultado previsto (`answerNext`, o una
// respuesta correcta por defecto) o queda retenida hasta que el test la resuelve (`holdNext`), para intercalar peticiones
// (idempotencia, concurrencia, cancelación). Como `fetch`, una llamada con la señal ya abortada falla, y una retenida se
// aborta si su señal se aborta (D-05). Una respuesta ya decidida se entrega aunque el cliente se vaya después: así se
// reproduce el caso «respondió el proveedor y no hubo nadie para recibirlo» (`undelivered`).
import type { AiGateway, ChatOutcome, ChatRequest, ModelCatalogEntry } from './gateway';

export interface HeldChat {
	readonly request: ChatRequest;
	resolve(outcome: ChatOutcome): void;
}

export interface FakeAiGateway extends AiGateway {
	readonly chatCalls: ChatRequest[];
	readonly generationCalls: string[];
	/** Llamadas retenidas, pendientes de que el test las resuelva. */
	readonly held: HeldChat[];
	/** Resultado de la próxima llamada no retenida. Por defecto, una respuesta correcta de 400 µUSD. */
	answerNext(outcome: ChatOutcome): void;
	/** La próxima llamada queda retenida hasta que el test la resuelve o se aborta. */
	holdNext(): void;
	/** Se ejecuta justo después de decidir la próxima respuesta no retenida (p. ej. para desconectar al cliente). */
	afterNextAnswer(callback: () => void): void;
	setGenerationCost(costMicroUsd: number | null): void;
	setModels(models: readonly ModelCatalogEntry[] | null): void;
}

export const FAKE_OK: Extract<ChatOutcome, { status: 'ok' }> = Object.freeze({
	status: 'ok',
	model: 'mistralai/mistral-small',
	provider: 'Mistral',
	generationId: 'gen-fake-1',
	text: 'Respuesta simulada',
	toolCalls: [],
	inputTokens: 100,
	outputTokens: 50,
	costMicroUsd: 400,
	truncated: false,
	imageDataUrl: null
});

const ABORTED: ChatOutcome = Object.freeze({
	status: 'error',
	reason: 'aborted',
	httpStatus: null
});

export function createFakeAiGateway(): FakeAiGateway {
	const queue: ChatOutcome[] = [];
	const holds: HeldChat[] = [];
	const chatCalls: ChatRequest[] = [];
	const generationCalls: string[] = [];
	let holdNextCall = false;
	let afterAnswer: (() => void) | undefined;
	let generationCost: number | null = null;
	let models: readonly ModelCatalogEntry[] | null = [];

	function holdUntilAborted(request: ChatRequest): Promise<ChatOutcome> {
		return new Promise((resolve) => {
			holds.push({ request, resolve });
			request.signal.addEventListener('abort', () => {
				resolve(ABORTED);
			});
		});
	}

	return {
		chatCalls,
		generationCalls,
		held: holds,
		chat(request: ChatRequest): Promise<ChatOutcome> {
			chatCalls.push(request);
			if (request.signal.aborted) return Promise.resolve(ABORTED);
			if (holdNextCall) {
				holdNextCall = false;
				return holdUntilAborted(request);
			}
			const outcome = queue.shift() ?? FAKE_OK;
			const after = afterAnswer;
			afterAnswer = undefined;
			after?.();
			return Promise.resolve(outcome);
		},
		generationCostMicroUsd(generationId: string): Promise<number | null> {
			generationCalls.push(generationId);
			return Promise.resolve(generationCost);
		},
		listModels(): Promise<readonly ModelCatalogEntry[] | null> {
			return Promise.resolve(models);
		},
		answerNext(outcome: ChatOutcome): void {
			queue.push(outcome);
		},
		holdNext(): void {
			holdNextCall = true;
		},
		afterNextAnswer(callback: () => void): void {
			afterAnswer = callback;
		},
		setGenerationCost(costMicroUsd: number | null): void {
			generationCost = costMicroUsd;
		},
		setModels(next: readonly ModelCatalogEntry[] | null): void {
			models = next;
		}
	};
}
