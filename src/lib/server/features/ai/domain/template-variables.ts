// Variables de plantilla: comprobación, sustitución y forma de los mensajes (BE-FR-78 CA1–CA4, BE-FR-79; T162). Puro.
// Las variables de texto reemplazan `{{nombre}}` dentro del texto; las de imagen son una parte `image_url` completa.

export interface TemplateVariableDef {
	readonly name: string;
	readonly type: 'text' | 'image';
	readonly required: boolean;
	readonly maxChars?: number;
	readonly maxMb?: number;
}

export type ChatContentPart =
	| { readonly type: 'text'; readonly text: string }
	| { readonly type: 'image_url'; readonly image_url: { readonly url: string } };

export interface ChatMessage {
	readonly role: 'system' | 'user' | 'assistant' | 'tool';
	readonly content?: string | readonly ChatContentPart[] | undefined;
	readonly tool_calls?: readonly unknown[] | undefined;
	readonly tool_call_id?: string | undefined;
}

export type TemplateContentPart =
	| { readonly type: 'text'; readonly text: string }
	| { readonly type: 'image_url'; readonly variable: string };

export interface TemplateMessage {
	readonly role: 'system' | 'user' | 'assistant';
	readonly content: string | readonly TemplateContentPart[];
}

export type VariableCheck = { readonly ok: true } | { readonly ok: false; readonly field: string };

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const MEBIBYTE = 1024 * 1024;

/** Bytes de una data URL en base64, estimados por exceso (hasta 2 bytes de relleno): conservador para `max_mb`. */
function decodedBytes(dataUrl: string): number {
	return Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
}

/**
 * Comprueba los valores enviados contra las variables declaradas: ninguna sobra, ninguna obligatoria falta, un texto no
 * excede `max_chars`, y una imagen es una data URL png/jpeg/webp que no excede `max_mb`. Devuelve el primer campo con
 * problema.
 */
export function checkVariables(
	defs: readonly TemplateVariableDef[],
	values: Readonly<Record<string, string>>
): VariableCheck {
	const declared = new Map(defs.map((def) => [def.name, def]));
	for (const name of Object.keys(values)) {
		if (!declared.has(name)) return { ok: false, field: name };
	}
	for (const def of defs) {
		const value = values[def.name];
		if (value === undefined) {
			if (def.required) return { ok: false, field: def.name };
			continue;
		}
		if (def.type === 'text' && def.maxChars !== undefined && value.length > def.maxChars) {
			return { ok: false, field: def.name };
		}
		if (def.type === 'image') {
			if (!IMAGE_DATA_URL.test(value)) return { ok: false, field: def.name };
			if (def.maxMb !== undefined && decodedBytes(value) > def.maxMb * MEBIBYTE) {
				return { ok: false, field: def.name };
			}
		}
	}
	return { ok: true };
}

/** Sustituye los `{{nombre}}` de texto (ausente → cadena vacía) y convierte las partes de imagen en `image_url`. */
export function renderTemplate(
	messages: readonly TemplateMessage[],
	values: Readonly<Record<string, string>>,
	defs: readonly TemplateVariableDef[]
): ChatMessage[] {
	const types = new Set(defs.filter((def) => def.type === 'text').map((def) => def.name));
	const fillText = (text: string): string =>
		text.replace(PLACEHOLDER, (_, name: string) => (types.has(name) ? (values[name] ?? '') : ''));

	return messages.map((message) => {
		if (typeof message.content === 'string') {
			return { role: message.role, content: fillText(message.content) };
		}
		const parts: ChatContentPart[] = message.content.map((part) =>
			part.type === 'text'
				? { type: 'text', text: fillText(part.text) }
				: { type: 'image_url', image_url: { url: values[part.variable] ?? '' } }
		);
		return { role: message.role, content: parts };
	});
}
