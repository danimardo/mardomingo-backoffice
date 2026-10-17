// _Outbox_ del entorno de test (T090): cada email se escribe en `.outbox/<epochMs>-<uuid>.json` antes de enviarse, para
// que las pruebas E2E lean el enlace de verificación o de recuperación. Solo se monta con `APP_ENV=test`: en
// producción no existe. El fichero contiene el mensaje completo, por eso nunca se usa fuera de las pruebas.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EmailSender, OutgoingEmail, SendResult } from './email-sender';

export interface OutboxOptions {
	readonly dir: string;
	readonly now: () => number;
}

/** Escribe cada email en el _outbox_ y luego lo entrega al envío de debajo (real o de memoria). */
export function withOutbox(inner: EmailSender, options: OutboxOptions): EmailSender {
	return {
		async send(email: OutgoingEmail): Promise<SendResult> {
			mkdirSync(options.dir, { recursive: true });
			const file = join(options.dir, `${String(options.now())}-${randomUUID()}.json`);
			writeFileSync(file, JSON.stringify(email, null, 2), 'utf8');
			return inner.send(email);
		}
	};
}
