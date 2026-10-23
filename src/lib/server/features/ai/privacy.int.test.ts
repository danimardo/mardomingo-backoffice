// Marcador de privacidad (BE-FR-38 CA1, principio VII; T177). El contenido de la petición nunca se guarda: tras operaciones
// completadas, fallidas, moderadas y canceladas, el texto del mensaje no aparece en ninguna tabla de SQLite ni en los
// eventos del logger, y los errores del proveedor se registran sin su mensaje.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runChat } from './service';
import { chatBody, chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import {
	markerInDatabase,
	markerInLogs,
	privacyMarker
} from '../../../../../tests/fixtures/privacy-marker';

let MARKER = '';

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
	MARKER = privacyMarker();
});

afterEach(() => {
	f.close();
});

describe('marcador de privacidad (BE-FR-38)', () => {
	it('el texto del mensaje no aparece en ninguna tabla ni en los eventos tras los cuatro desenlaces', async () => {
		const body = chatBody({ messages: [{ role: 'user', content: MARKER }] });

		// Completada.
		await runChat(f.deps, f.context(), body);

		// Fallida (todos los intentos).
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		await runChat(f.deps, f.context(), body).catch(() => undefined);

		// Moderada.
		f.gateway.answerNext({ status: 'flagged' });
		await runChat(f.deps, f.context(), body).catch(() => undefined);

		// Cancelada antes de la respuesta.
		f.gateway.holdNext();
		const controller = new AbortController();
		const pending = runChat(f.deps, f.context({ signal: controller.signal }), body);
		controller.abort();
		await pending;

		expect(f.gateway.chatCalls.some((call) => JSON.stringify(call.messages).includes(MARKER))).toBe(
			true
		);
		expect(markerInDatabase(f.base.database, MARKER)).toBe(false);
		expect(markerInLogs(f.base.logger, MARKER)).toBe(false);
	});
});
