// Implementación real del envío con el SDK de Resend (BE-FR-58; R12). La clave de idempotencia viaja en cada envío.
// Si el proveedor rechaza el envío o no responde, se devuelve solo `error.name` (nunca el mensaje ni el destinatario).
import { Resend } from 'resend';
import type { EmailSender, OutgoingEmail, SendResult } from './email-sender';

export interface ResendSenderOptions {
	readonly apiKey: string;
	readonly from: string;
	/** Por defecto, el API de Resend; en pruebas, el simulador (`MOCK_RESEND_URL`). */
	readonly baseUrl?: string;
}

export function createResendSender(options: ResendSenderOptions): EmailSender {
	const resend = new Resend(
		options.apiKey,
		options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }
	);
	return {
		async send(email: OutgoingEmail): Promise<SendResult> {
			try {
				const { data, error } = await resend.emails.send(
					{
						from: options.from,
						to: email.to,
						subject: email.subject,
						text: email.text,
						html: email.html,
						replyTo: email.replyTo
					},
					{ idempotencyKey: email.idempotencyKey }
				);
				if (error !== null) return { ok: false, errorCode: error.name };
				return { ok: true, providerId: data.id };
			} catch (cause) {
				return { ok: false, errorCode: cause instanceof Error ? cause.name : 'UnknownError' };
			}
		}
	};
}
