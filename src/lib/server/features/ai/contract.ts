// Contrato de E07 · `POST /ai/chat` (contracts/api-v1.md E07, 1.6; FR-062, D-19; T156). Esquemas estrictos: un campo
// desconocido es `VALIDATION_ERROR`. La forma se valida aquí; lo que depende de la operación (modo, capacidades, tamaños)
// lo comprueba `domain/chat-input.ts`.
import { z } from 'zod';

/** Variable de plantilla: `nombre` con letras minúsculas, dígitos y guiones bajos (3.5). */
const VariableName = z
	.string()
	.regex(/^[a-z][a-z0-9_]*$/)
	.max(64);
const OperationKey = z
	.string()
	.regex(/^[a-z][a-z0-9_]*$/)
	.max(64);

/** Imagen en _data URL_ png, jpeg o webp; nunca una URL remota (api-v1 E07 3.3). */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const TextPart = z.strictObject({ type: z.literal('text'), text: z.string().max(2_000_000) });
const ImagePart = z.strictObject({
	type: z.literal('image_url'),
	image_url: z.strictObject({ url: z.string().regex(IMAGE_DATA_URL).max(8_000_000) })
});

const ToolCall = z.strictObject({
	id: z.string().min(1).max(128),
	type: z.literal('function'),
	function: z.strictObject({ name: z.string().min(1).max(128), arguments: z.string().max(200_000) })
});

export const ChatMessage = z.strictObject({
	role: z.enum(['system', 'user', 'assistant', 'tool']),
	content: z
		.union([z.string().max(2_000_000), z.array(z.union([TextPart, ImagePart])).min(1)])
		.optional(),
	tool_calls: z.array(ToolCall).min(1).optional(),
	tool_call_id: z.string().min(1).max(128).optional()
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ResponseFormat = z.strictObject({
	type: z.literal('json_schema'),
	json_schema: z.strictObject({
		name: z.string().min(1).max(64),
		strict: z.boolean().optional(),
		schema: z.record(z.string(), z.unknown())
	})
});

export const Tool = z.strictObject({
	type: z.literal('function'),
	function: z.strictObject({
		name: z.string().min(1).max(64),
		description: z.string().max(1_000).optional(),
		parameters: z.record(z.string(), z.unknown())
	})
});

export const ToolChoice = z.union([
	z.enum(['auto', 'none', 'required']),
	z.strictObject({
		type: z.literal('function'),
		function: z.strictObject({ name: z.string().min(1).max(64) })
	})
]);

export const ChatRequestBody = z.strictObject({
	operation: OperationKey,
	messages: z.array(ChatMessage).min(1).optional(),
	variables: z.record(VariableName, z.string().max(2_000_000)).optional(),
	response_format: ResponseFormat.optional(),
	tools: z.array(Tool).min(1).optional(),
	tool_choice: ToolChoice.optional()
});
export type ChatRequestBody = z.infer<typeof ChatRequestBody>;

/** `Idempotency-Key`: opcional; si llega, debe ser un UUID (BE-FR-81). */
export const IdempotencyKeyHeader = z.uuid();

/** Salida 200 (7.3). Nunca el modelo ni el proveedor (BE-FR-80 CA1). */
export interface ChatResponseBody {
	readonly text: string | null;
	readonly json: unknown;
	readonly structuredValid: boolean | null;
	readonly toolCalls: readonly unknown[] | null;
	readonly truncated: boolean;
	readonly operationId: string;
	readonly chargedMicro: number;
	readonly balance: {
		readonly totalMicro: number;
		readonly reservedMicro: number;
		readonly availableMicro: number;
		readonly debtMicro: number;
	};
}

/** Lee la cabecera opcional de idempotencia. Un valor que no es UUID es un error de validación del campo. */
export function idempotencyKeyOf(
	value: string | null
): { readonly ok: true; readonly key: string | null } | { readonly ok: false } {
	if (value === null) return { ok: true, key: null };
	const parsed = IdempotencyKeyHeader.safeParse(value);
	return parsed.success ? { ok: true, key: parsed.data } : { ok: false };
}
