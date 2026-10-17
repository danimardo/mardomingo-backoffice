// Puerto de verificación del captcha del registro (D-02; BE-FR-01 CA3). `accounts` lo usa antes de llamar a
// Better Auth. Tres resultados: válido, inválido y no disponible; el último no bloquea en silencio, se reporta con
// `accounts.captcha.unavailable` y el usuario puede reintentar.

export type CaptchaOutcome = 'valid' | 'invalid' | 'unavailable';

export interface CaptchaCheck {
	/** Campo `cf-turnstile-response` del formulario. Vacío si el widget no cargó (sin JavaScript). */
	readonly token: string;
	/** IP del cliente (`event.getClientAddress()`); `null` si no se pudo determinar. */
	readonly remoteIp: string | null;
	/** Clave de idempotencia del intento, para que un reintento no cuente dos veces. */
	readonly idempotencyKey: string;
}

export interface CaptchaVerifier {
	verify(check: CaptchaCheck): Promise<CaptchaOutcome>;
}
