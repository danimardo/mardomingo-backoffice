// Validación semántica de la entrada de `/ai/chat` (BE-FR-31, BE-FR-34, BE-FR-44, BE-FR-78; T162).
import { describe, expect, it } from 'vitest';
import { checkChatInput, type ChatOperationView } from './chat-input';

const LIBRE: ChatOperationView = {
	appId: 'app_1',
	active: true,
	kind: 'chat',
	mode: 'libre',
	capabilities: { image_input: true, structured_output: true, tools: true },
	limits: { maxTextChars: 20, maxImageMb: 1 }
};

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const text = (content: string) => [{ role: 'user' as const, content }];

describe('checkChatInput', () => {
	it('una petición libre válida pasa', () => {
		expect(
			checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages: text('hola') } })
		).toEqual({
			ok: true
		});
	});

	it('operación inactiva, de otra app o que no es de chat → VALIDATION_ERROR en operation', () => {
		const body = { messages: text('hola') };
		expect(
			checkChatInput({ operation: { ...LIBRE, active: false }, appId: 'app_1', body })
		).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'operation'
		});
		expect(checkChatInput({ operation: LIBRE, appId: 'app_2', body })).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'operation'
		});
		expect(
			checkChatInput({ operation: { ...LIBRE, kind: 'image' }, appId: 'app_1', body })
		).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'operation'
		});
	});

	it('en plantilla no se envían mensajes; en libre no se envían variables', () => {
		const plantilla = { ...LIBRE, mode: 'plantilla' as const };
		expect(
			checkChatInput({ operation: plantilla, appId: 'app_1', body: { messages: text('x') } })
		).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'messages'
		});
		expect(
			checkChatInput({ operation: LIBRE, appId: 'app_1', body: { variables: { a: 'b' } } })
		).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'variables'
		});
	});

	it('response_format solo si la operación lo admite y es libre', () => {
		const rf = { type: 'json_schema', json_schema: { name: 'r', schema: {} } };
		expect(
			checkChatInput({
				operation: { ...LIBRE, capabilities: { ...LIBRE.capabilities, structured_output: false } },
				appId: 'app_1',
				body: { messages: text('x'), response_format: rf }
			})
		).toEqual({ ok: false, code: 'VALIDATION_ERROR', field: 'response_format' });
	});

	it('tools y tool_choice solo si la operación los admite y es libre', () => {
		expect(
			checkChatInput({
				operation: { ...LIBRE, capabilities: { ...LIBRE.capabilities, tools: false } },
				appId: 'app_1',
				body: { messages: text('x'), tool_choice: 'auto' }
			})
		).toEqual({ ok: false, code: 'VALIDATION_ERROR', field: 'tools' });
	});

	it('una imagen sin image_input → VALIDATION_ERROR en messages', () => {
		const messages = [
			{
				role: 'user' as const,
				content: [{ type: 'image_url' as const, image_url: { url: PNG } }]
			}
		];
		expect(
			checkChatInput({
				operation: { ...LIBRE, capabilities: { ...LIBRE.capabilities, image_input: false } },
				appId: 'app_1',
				body: { messages }
			})
		).toEqual({ ok: false, code: 'VALIDATION_ERROR', field: 'messages' });
	});

	it('texto total por encima de max_text_chars → PAYLOAD_TOO_LARGE', () => {
		expect(
			checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages: text('x'.repeat(21)) } })
		).toEqual({ ok: false, code: 'PAYLOAD_TOO_LARGE', field: 'messages' });
	});

	it('imagen por encima de max_image_mb → PAYLOAD_TOO_LARGE', () => {
		const big = `data:image/png;base64,${'A'.repeat(Math.ceil((1024 * 1024 * 1.4 * 4) / 3))}`;
		const messages = [
			{
				role: 'user' as const,
				content: [{ type: 'image_url' as const, image_url: { url: big } }]
			}
		];
		expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages } })).toEqual({
			ok: false,
			code: 'PAYLOAD_TOO_LARGE',
			field: 'messages'
		});
	});
});

describe('modo libre sin mensajes', () => {
	it('sin messages, VALIDATION_ERROR en messages', () => {
		expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: {} })).toEqual({
			ok: false,
			code: 'VALIDATION_ERROR',
			field: 'messages'
		});
	});
});

describe('ramas de tamaño y de forma', () => {
	it('una petición de plantilla sin mensajes ni variables propios es válida (la forma la fija la plantilla)', () => {
		const plantilla = { ...LIBRE, mode: 'plantilla' as const };
		expect(checkChatInput({ operation: plantilla, appId: 'app_1', body: {} })).toEqual({
			ok: true
		});
	});

	it('un mensaje sin contenido (llamada a herramienta) no cuenta como texto', () => {
		const messages = [
			{
				role: 'assistant' as const,
				tool_calls: [
					{ id: 'call_1', type: 'function', function: { name: 'buscar', arguments: '{}' } }
				]
			}
		];
		expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages } })).toEqual({
			ok: true
		});
	});

	it('el relleno de una imagen (== o sin relleno) cuenta bien para max_image_mb', () => {
		const doublePadded = `data:image/png;base64,${'A'.repeat(8)}==`;
		const unpadded = `data:image/png;base64,${'A'.repeat(8)}`;
		for (const url of [doublePadded, unpadded]) {
			const messages = [
				{ role: 'user' as const, content: [{ type: 'image_url' as const, image_url: { url } }] }
			];
			expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages } })).toEqual({
				ok: true
			});
		}
	});
});

describe('contenido mixto de texto e imagen', () => {
	it('solo el texto cuenta para max_text_chars; la imagen cuenta aparte', () => {
		const mixed = [
			{
				role: 'user' as const,
				content: [
					{ type: 'text' as const, text: 'x'.repeat(15) },
					{ type: 'image_url' as const, image_url: { url: PNG } }
				]
			}
		];
		expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages: mixed } })).toEqual(
			{ ok: true }
		);

		const over = [
			{ role: 'user' as const, content: [{ type: 'text' as const, text: 'x'.repeat(21) }] }
		];
		expect(checkChatInput({ operation: LIBRE, appId: 'app_1', body: { messages: over } })).toEqual({
			ok: false,
			code: 'PAYLOAD_TOO_LARGE',
			field: 'messages'
		});
	});
});
