// Validación semántica de la entrada de `/ai/chat` (BE-FR-31, BE-FR-34, BE-FR-44, BE-FR-78; T162). Puro. La forma de
// cada campo la comprueba el contrato Zod (`contract.ts`); aquí, lo que depende de la operación: modo, capacidades,
// tamaños y que la operación sea una de la app (api-v1 1.8, pasos 9–11 y el tamaño de 13).
import type { ChatContentPart, ChatMessage } from './template-variables';

export interface ChatOperationView {
	readonly appId: string;
	readonly active: boolean;
	readonly kind: 'chat' | 'transcription' | 'image';
	readonly mode: 'libre' | 'plantilla';
	readonly capabilities: {
		readonly image_input: boolean;
		readonly structured_output: boolean;
		readonly tools: boolean;
	};
	readonly limits: { readonly maxTextChars: number; readonly maxImageMb: number };
}

export interface ChatBodyView {
	readonly messages?: readonly ChatMessage[] | undefined;
	readonly variables?: Readonly<Record<string, string>> | undefined;
	readonly response_format?: unknown;
	readonly tools?: unknown;
	readonly tool_choice?: unknown;
}

export type ChatInputCheck =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly code: 'VALIDATION_ERROR' | 'PAYLOAD_TOO_LARGE';
			readonly field: 'operation' | 'messages' | 'variables' | 'response_format' | 'tools';
	  };

const MEBIBYTE = 1024 * 1024;

/** Tamaño de una imagen en _data URL_, estimado por exceso (hasta 2 bytes de relleno): conservador para un límite. */
function imageBytes(url: string): number {
	return Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4);
}

/** Partes de contenido de un mensaje; una cadena cuenta como una parte de texto y un mensaje sin contenido, como ninguna. */
function contentParts(content: ChatMessage['content']): readonly ChatContentPart[] {
	if (content === undefined) return [];
	if (typeof content === 'string') return [{ type: 'text', text: content }];
	return content;
}

/** Caracteres de texto de los mensajes (cadenas y partes de texto). Es la base de la estimación de tokens. */
export function charCountOf(messages: readonly ChatMessage[]): number {
	return messages
		.flatMap((message) => contentParts(message.content))
		.reduce((chars, part) => (part.type === 'text' ? chars + part.text.length : chars), 0);
}

/** URL de cada imagen de los mensajes, en orden. */
function imageUrlsOf(messages: readonly ChatMessage[]): string[] {
	return messages
		.flatMap((message) => contentParts(message.content))
		.flatMap((part) => (part.type === 'image_url' ? [part.image_url.url] : []));
}

/** Número de partes de imagen de los mensajes. */
export function imageCountOf(messages: readonly ChatMessage[]): number {
	return imageUrlsOf(messages).length;
}

/** Texto total y tamaño de imagen de los mensajes ya definitivos (libre o renderizados de plantilla). */
export function checkMessageSizes(
	messages: readonly ChatMessage[],
	limits: ChatOperationView['limits']
): ChatInputCheck {
	const maxImage = Math.max(0, ...imageUrlsOf(messages).map(imageBytes));
	if (charCountOf(messages) > limits.maxTextChars) {
		return { ok: false, code: 'PAYLOAD_TOO_LARGE', field: 'messages' };
	}
	if (maxImage > limits.maxImageMb * MEBIBYTE) {
		return { ok: false, code: 'PAYLOAD_TOO_LARGE', field: 'messages' };
	}
	return { ok: true };
}

function hasImage(messages: readonly ChatMessage[]): boolean {
	return imageCountOf(messages) > 0;
}

/** Reglas de la operación para una petición de chat (modo, capacidades, tamaños). */
export function checkChatInput(input: {
	readonly operation: ChatOperationView;
	readonly appId: string;
	readonly body: ChatBodyView;
}): ChatInputCheck {
	const { operation, body } = input;
	if (!operation.active || operation.kind !== 'chat' || operation.appId !== input.appId) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'operation' };
	}
	const libre = operation.mode === 'libre';
	if (libre && body.variables !== undefined) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'variables' };
	}
	if (!libre && body.messages !== undefined) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'messages' };
	}
	if (body.response_format !== undefined && (!libre || !operation.capabilities.structured_output)) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'response_format' };
	}
	const usesTools = body.tools !== undefined || body.tool_choice !== undefined;
	if (usesTools && (!libre || !operation.capabilities.tools)) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'tools' };
	}
	if (!libre) return { ok: true };
	if (body.messages === undefined)
		return { ok: false, code: 'VALIDATION_ERROR', field: 'messages' };
	if (hasImage(body.messages) && !operation.capabilities.image_input) {
		return { ok: false, code: 'VALIDATION_ERROR', field: 'messages' };
	}
	return checkMessageSizes(body.messages, operation.limits);
}
