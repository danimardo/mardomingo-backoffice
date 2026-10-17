// Envío en memoria para las pruebas (T090). Guarda cada envío aceptado; con `fail` responde con el código indicado,
// para probar los caminos de error sin red. Nunca escribe en disco ni llama a ningún proveedor.
import type { EmailSender, OutgoingEmail, SendResult } from './email-sender';

export interface FakeEmailSender extends EmailSender {
	readonly sent: readonly OutgoingEmail[];
	/** Hace que los siguientes envíos fallen con ese código; `undefined` vuelve al modo normal. */
	fail(errorCode: string | undefined): void;
}

export function createFakeEmailSender(): FakeEmailSender {
	const sent: OutgoingEmail[] = [];
	let failure: string | undefined;
	let counter = 0;
	return {
		sent,
		fail(errorCode) {
			failure = errorCode;
		},
		send(email: OutgoingEmail): Promise<SendResult> {
			if (failure !== undefined) return Promise.resolve({ ok: false, errorCode: failure });
			sent.push(email);
			counter += 1;
			return Promise.resolve({ ok: true, providerId: `fake_${String(counter)}` });
		}
	};
}
