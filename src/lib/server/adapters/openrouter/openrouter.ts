// Adaptador real de OpenRouter (BE-FR-33, BE-FR-20, BE-FR-75, D-09, R11; T157). Sin _streaming_, con
// `data_collection: "deny"` en cada petición y con `usage.cost` cuando viene. Los esquemas Zod validan cada respuesta y
// los errores son motivos saneados: nunca el mensaje ni el cuerpo del proveedor.
import { z } from 'zod';
import type { AiGateway, ChatOutcome, ChatRequest, ModelCatalogEntry } from './gateway';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenRouterConfig {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly referer?: string;
	readonly fetch?: FetchLike;
}

export const CHAT_REFERER = 'https://api.mardomingo.com';

const MICRO = 1_000_000;

/** Respuesta leída: el estado HTTP y el texto, sin interpretar. Un fallo de red o de tiempo no tiene estado. */
type RawReply =
	| { readonly ok: true; readonly status: number; readonly ok2xx: boolean; readonly text: string }
	| {
			readonly ok: false;
			readonly reason: 'timeout' | 'aborted' | 'unavailable';
			readonly status: number | null;
	  };

function parseJson(
	text: string
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

/** USD → micro-USD con redondeo hacia arriba; el `toPrecision` evita el ruido de coma flotante (1e-6 × 1e6 = 1,0000000002). */
export function usdToMicroUsd(usd: number): number {
	return Math.ceil(Number((usd * MICRO).toPrecision(12)));
}

/** Precio por token (cadena en USD, como lo publica OpenRouter) → µUSD por millón de tokens, entero hacia arriba. */
export function perTokenToPerMTokMicroUsd(perToken: string): number | null {
	const value = Number(perToken);
	if (!Number.isFinite(value) || value < 0) return null;
	return Math.ceil(Number((value * MICRO * MICRO).toPrecision(12)));
}

const Usage = z.object({
	prompt_tokens: z.number().int().nonnegative(),
	completion_tokens: z.number().int().nonnegative(),
	cost: z.number().nonnegative().nullish()
});

const ChatBody = z.object({
	id: z.string().min(1),
	model: z.string().min(1),
	provider: z.string().nullish(),
	choices: z
		.array(
			z.object({
				finish_reason: z.string().nullish(),
				message: z.object({
					content: z.string().nullish(),
					tool_calls: z.array(z.unknown()).nullish()
				})
			})
		)
		.min(1),
	usage: Usage
});

const ErrorBody = z.object({
	error: z.object({ metadata: z.record(z.string(), z.unknown()).nullish() })
});

const GenerationBody = z.object({ data: z.object({ total_cost: z.number().nonnegative() }) });

const ModelsBody = z.object({
	data: z.array(
		z.object({
			id: z.string().min(1),
			pricing: z.object({ prompt: z.string(), completion: z.string() }),
			architecture: z.object({
				input_modalities: z.array(z.string()),
				output_modalities: z.array(z.string())
			}),
			supported_parameters: z.array(z.string())
		})
	)
});

function classify(error: unknown, signal: AbortSignal): 'timeout' | 'aborted' | 'unavailable' {
	if (signal.aborted) return 'aborted';
	if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
	return 'unavailable';
}

function isFlagged(body: unknown): boolean {
	const parsed = ErrorBody.safeParse(body);
	return parsed.success && parsed.data.error.metadata?.flagged_input !== undefined;
}

export function createOpenRouterGateway(config: OpenRouterConfig): AiGateway {
	const doFetch: FetchLike = config.fetch ?? ((input, init) => fetch(input, init));
	const base = config.baseUrl.replace(/\/$/, '');
	const authorization = `Bearer ${config.apiKey}`;

	async function request(
		url: string,
		init: RequestInit,
		signal: AbortSignal,
		timeoutMs: number
	): Promise<RawReply> {
		let response: Response;
		try {
			response = await doFetch(url, {
				...init,
				signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
			});
		} catch (error) {
			return { ok: false, reason: classify(error, signal), status: null };
		}
		try {
			const text = await response.text();
			return { ok: true, status: response.status, ok2xx: response.ok, text };
		} catch (error) {
			return { ok: false, reason: classify(error, signal), status: response.status };
		}
	}

	return {
		async chat(input: ChatRequest): Promise<ChatOutcome> {
			const body = {
				model: input.model,
				messages: input.messages,
				max_tokens: input.maxTokens ?? undefined,
				temperature: input.temperature,
				...(input.responseFormat !== undefined ? { response_format: input.responseFormat } : {}),
				...(input.tools !== undefined ? { tools: input.tools } : {}),
				...(input.toolChoice !== undefined ? { tool_choice: input.toolChoice } : {}),
				provider: {
					data_collection: 'deny',
					allow_fallbacks: true,
					...(input.order !== undefined ? { order: input.order } : {}),
					...(input.requireParameters ? { require_parameters: true } : {})
				}
			};
			const result = await request(
				`${base}/api/v1/chat/completions`,
				{
					method: 'POST',
					headers: {
						authorization: authorization,
						'content-type': 'application/json',
						'HTTP-Referer': config.referer ?? CHAT_REFERER,
						'X-Title': input.appTitle
					},
					body: JSON.stringify(body)
				},
				input.signal,
				input.timeoutMs
			);
			if (!result.ok) return { status: 'error', reason: result.reason, httpStatus: result.status };
			const json = parseJson(result.text);
			if (isFlagged(json.ok ? json.value : undefined)) return { status: 'flagged' };
			if (!result.ok2xx) return { status: 'error', reason: 'http', httpStatus: result.status };
			if (!json.ok) return { status: 'error', reason: 'invalid', httpStatus: result.status };
			if (ErrorBody.safeParse(json.value).success) {
				return { status: 'error', reason: 'http', httpStatus: result.status };
			}
			const parsed = ChatBody.safeParse(json.value);
			if (!parsed.success) return { status: 'error', reason: 'invalid', httpStatus: result.status };
			const reply = parsed.data;
			const first = reply.choices[0];
			return {
				status: 'ok',
				model: reply.model,
				provider: reply.provider ?? null,
				generationId: reply.id,
				text: first?.message.content ?? null,
				toolCalls: first?.message.tool_calls ?? [],
				inputTokens: reply.usage.prompt_tokens,
				outputTokens: reply.usage.completion_tokens,
				costMicroUsd: typeof reply.usage.cost === 'number' ? usdToMicroUsd(reply.usage.cost) : null,
				truncated: first?.finish_reason === 'length'
			};
		},

		async generationCostMicroUsd(
			generationId: string,
			signal: AbortSignal
		): Promise<number | null> {
			const result = await request(
				`${base}/api/v1/generation?id=${encodeURIComponent(generationId)}`,
				{ method: 'GET', headers: { authorization } },
				signal,
				10_000
			);
			if (!result.ok || !result.ok2xx) return null;
			const json = parseJson(result.text);
			const parsed = json.ok ? GenerationBody.safeParse(json.value) : null;
			return parsed?.success ? usdToMicroUsd(parsed.data.data.total_cost) : null;
		},

		async listModels(signal: AbortSignal): Promise<readonly ModelCatalogEntry[] | null> {
			const result = await request(
				`${base}/api/v1/models?output_modalities=all`,
				{ method: 'GET', headers: { authorization } },
				signal,
				15_000
			);
			if (!result.ok || !result.ok2xx) return null;
			const json = parseJson(result.text);
			const parsed = json.ok ? ModelsBody.safeParse(json.value) : null;
			if (!parsed?.success) return null;
			return parsed.data.data.flatMap((model): ModelCatalogEntry[] => {
				const input = perTokenToPerMTokMicroUsd(model.pricing.prompt);
				const output = perTokenToPerMTokMicroUsd(model.pricing.completion);
				if (input === null || output === null) return [];
				return [
					{
						id: model.id,
						inputPerMTokMicroUsd: input,
						outputPerMTokMicroUsd: output,
						inputModalities: model.architecture.input_modalities,
						outputModalities: model.architecture.output_modalities,
						supportedParameters: model.supported_parameters
					}
				];
			});
		}
	};
}
