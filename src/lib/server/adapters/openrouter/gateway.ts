// Puerto de OpenRouter (BE-FR-33, BE-FR-20; T157). El servicio de `ai` depende de esta interfaz, nunca de `fetch`. Los
// resultados son valores: el proveedor nunca lanza al dominio, y los errores llevan un motivo, sin el mensaje del proveedor.

export interface ProviderTextPart {
	readonly type: 'text';
	readonly text: string;
}

export interface ProviderImagePart {
	readonly type: 'image_url';
	readonly image_url: { readonly url: string };
}

export interface ProviderMessage {
	readonly role: 'system' | 'user' | 'assistant' | 'tool';
	readonly content?: string | readonly (ProviderTextPart | ProviderImagePart)[] | undefined;
	readonly tool_calls?: readonly unknown[] | undefined;
	readonly tool_call_id?: string | undefined;
}

export interface ChatRequest {
	readonly model: string;
	readonly messages: readonly ProviderMessage[];
	readonly maxTokens: number | null;
	/** Grados, ya convertidos desde milésimas de la operación. */
	readonly temperature: number;
	readonly responseFormat?: unknown;
	readonly tools?: unknown;
	readonly toolChoice?: unknown;
	readonly order?: readonly string[];
	readonly requireParameters: boolean;
	/** Nombre de la app que llama, para la cabecera `X-Title`. */
	readonly appTitle: string;
	/** Tiempo máximo de este intento. */
	readonly timeoutMs: number;
	/** Señal de la petición entrante: si el cliente se va, la llamada se aborta (D-05). */
	readonly signal: AbortSignal;
}

export type ChatOutcome =
	| {
			readonly status: 'ok';
			readonly model: string;
			readonly provider: string | null;
			readonly generationId: string;
			readonly text: string | null;
			readonly toolCalls: readonly unknown[];
			readonly inputTokens: number;
			readonly outputTokens: number;
			/** Coste de `usage.cost` en micro-USD; `null` si el proveedor no lo informa en la respuesta. */
			readonly costMicroUsd: number | null;
			readonly truncated: boolean;
	  }
	| { readonly status: 'flagged' }
	| {
			readonly status: 'error';
			readonly reason: 'timeout' | 'aborted' | 'unavailable' | 'http' | 'invalid';
			readonly httpStatus: number | null;
	  };

export interface ModelCatalogEntry {
	readonly id: string;
	readonly inputPerMTokMicroUsd: number;
	readonly outputPerMTokMicroUsd: number;
	readonly inputModalities: readonly string[];
	readonly outputModalities: readonly string[];
	readonly supportedParameters: readonly string[];
}

export interface AiGateway {
	chat(request: ChatRequest): Promise<ChatOutcome>;
	/** Coste de una generación por su id (`/generation`), en micro-USD; `null` si no se puede obtener. */
	generationCostMicroUsd(generationId: string, signal: AbortSignal): Promise<number | null>;
	/** Catálogo de modelos con precios de texto; `null` si el proveedor no responde. */
	listModels(signal: AbortSignal): Promise<readonly ModelCatalogEntry[] | null>;
}
