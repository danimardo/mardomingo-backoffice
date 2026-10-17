// Marcador de privacidad (BE-FR-38 CA1, principio VII; T177). El contenido de la petición nunca se guarda: tras operaciones
// completadas, fallidas, moderadas y canceladas, el texto del mensaje no aparece en ninguna tabla de SQLite ni en los
// eventos del logger, y los errores del proveedor se registran sin su mensaje.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runChat } from './service';
import { chatBody, chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';

const MARKER = 'PRIVADO-MARCADOR-9f3c2a7e-no-debe-aparecer';

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
});

afterEach(() => {
	f.close();
});

/** Todo el contenido de todas las tablas, serializado, para buscar el marcador. */
function everyTableText(): string {
	const sqlite = f.base.database.sqlite;
	const tables = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
		.pluck()
		.all()
		.map(String);
	return tables
		.map((name) => JSON.stringify(sqlite.prepare(`SELECT * FROM "${name}"`).all()))
		.join('\n');
}

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
		expect(everyTableText()).not.toContain(MARKER);
		expect(JSON.stringify(f.base.logger.events)).not.toContain(MARKER);
	});
});
