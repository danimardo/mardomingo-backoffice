// Puerto y adaptador real de Voxtral (BE-FR-35, R11; T181). El servicio de `ai` depende de `Transcriber`, no de `fetch`.
// Los errores de facturación (401, 402 y 429) se distinguen de los fallos técnicos, porque tienen su propia alerta
// (`ai.provider.billing_error`). Un error nunca lleva el mensaje del proveedor.
import { z } from 'zod';

export interface TranscribeRequest {
	/** Audio ya convertido (mp3 o wav según el caso) o el original si el proveedor lo acepta. */
	readonly audio: Uint8Array;
	readonly fileName: string;
	readonly mimeType: string;
	readonly timeoutMs: number;
	/** Señal de la petición: si el cliente se va, la llamada se aborta (D-05). */
	readonly signal: AbortSignal;
}

export type TranscribeOutcome =
	| {
			readonly status: 'ok';
			readonly text: string;
			/** Segundos de audio facturados por el proveedor (`usage.prompt_audio_seconds`); `null` si no los informa. */
			readonly audioSeconds: number | null;
	  }
	| {
			readonly status: 'error';
			readonly reason: 'billing' | 'timeout' | 'aborted' | 'unavailable' | 'http' | 'invalid';
			readonly httpStatus: number | null;
	  };

export interface Transcriber {
	transcribe(request: TranscribeRequest): Promise<TranscribeOutcome>;
}

export type MistralFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface MistralConfig {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly model?: string;
	readonly fetch?: MistralFetch;
}

export const VOXTRAL_MODEL = 'voxtral-mini-latest';

const BILLING_STATUSES: readonly number[] = Object.freeze([401, 402, 429]);

const TranscriptionBody = z.object({
	text: z.string(),
	usage: z.object({ prompt_audio_seconds: z.number().nonnegative().nullish() }).nullish()
});

function classify(error: unknown, signal: AbortSignal): 'timeout' | 'aborted' | 'unavailable' {
	if (signal.aborted) return 'aborted';
	if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
	return 'unavailable';
}

export function createMistralTranscriber(config: MistralConfig): Transcriber {
	const doFetch: MistralFetch = config.fetch ?? ((input, init) => fetch(input, init));
	const base = config.baseUrl.replace(/\/$/, '');
	const model = config.model ?? VOXTRAL_MODEL;

	return {
		async transcribe(request: TranscribeRequest): Promise<TranscribeOutcome> {
			const form = new FormData();
			form.append('model', model);
			form.append(
				'file',
				new Blob([new Uint8Array(request.audio)], { type: request.mimeType }),
				request.fileName
			);

			let response: Response;
			try {
				response = await doFetch(`${base}/v1/audio/transcriptions`, {
					method: 'POST',
					headers: { authorization: `Bearer ${config.apiKey}` },
					body: form,
					signal: AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)])
				});
			} catch (error) {
				return { status: 'error', reason: classify(error, request.signal), httpStatus: null };
			}

			if (BILLING_STATUSES.includes(response.status)) {
				return { status: 'error', reason: 'billing', httpStatus: response.status };
			}
			if (!response.ok) {
				return { status: 'error', reason: 'http', httpStatus: response.status };
			}

			let parsedJson: unknown;
			try {
				parsedJson = await response.json();
			} catch (error) {
				const reason = request.signal.aborted
					? 'aborted'
					: classify(error, request.signal) === 'timeout'
						? 'timeout'
						: 'invalid';
				return { status: 'error', reason, httpStatus: response.status };
			}
			const parsed = TranscriptionBody.safeParse(parsedJson);
			if (!parsed.success)
				return { status: 'error', reason: 'invalid', httpStatus: response.status };
			return {
				status: 'ok',
				text: parsed.data.text,
				audioSeconds: parsed.data.usage?.prompt_audio_seconds ?? null
			};
		}
	};
}
