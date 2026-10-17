// Puerto de envío de email (FR-098; BE-FR-58). Los servicios de `notifications` dependen de esta interfaz; las
// implementaciones son la real (Resend), la de memoria para las pruebas y el _outbox_ de ficheros del entorno de test.
// Ningún resultado contiene el mensaje del proveedor: solo un código corto, para no filtrar contenido ni direcciones.

export interface OutgoingEmail {
	readonly to: string;
	readonly subject: string;
	readonly text: string;
	readonly html: string;
	/** Reply-To: el email de soporte de la app o el global (BE-FR-58). */
	readonly replyTo: string;
	/** Clave de idempotencia: un reintento del mismo envío no duplica el email en el proveedor. */
	readonly idempotencyKey: string;
}

export type SendResult =
	| { readonly ok: true; readonly providerId: string }
	| { readonly ok: false; readonly errorCode: string };

export interface EmailSender {
	send(email: OutgoingEmail): Promise<SendResult>;
}
