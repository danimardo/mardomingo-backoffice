// Verificación real de Turnstile (BE-FR-01 CA3; R12). `POST {endpoint}/turnstile/v0/siteverify` con el secreto, el token
// del formulario, la IP y la clave de idempotencia. La respuesta se valida con Zod; un fallo de red, un 5xx o una
// respuesta que no encaja son «no disponible», no «inválido»: el usuario puede reintentar.
import { z } from 'zod';
import type { CaptchaCheck, CaptchaOutcome, CaptchaVerifier } from './captcha-verifier';

const SITEVERIFY_RESPONSE = z.object({ success: z.boolean() });
const DEFAULT_TIMEOUT_MS = 5_000;

export interface TurnstileOptions {
	readonly secret: string;
	/** `https://challenges.cloudflare.com` en producción; el simulador en pruebas (`MOCK_TURNSTILE_URL`). */
	readonly endpoint: string;
	readonly timeoutMs?: number;
}

export function createTurnstileVerifier(options: TurnstileOptions): CaptchaVerifier {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	return {
		async verify(check: CaptchaCheck): Promise<CaptchaOutcome> {
			// Sin token no hay nada que verificar: el formulario se envió sin captcha (o sin JavaScript).
			if (check.token === '') return 'invalid';
			try {
				const response = await fetch(`${options.endpoint}/turnstile/v0/siteverify`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						secret: options.secret,
						response: check.token,
						remoteip: check.remoteIp ?? undefined,
						idempotency_key: check.idempotencyKey
					}),
					signal: AbortSignal.timeout(timeoutMs)
				});
				if (!response.ok) return 'unavailable';
				const body = SITEVERIFY_RESPONSE.safeParse(await response.json());
				if (!body.success) return 'unavailable';
				return body.data.success ? 'valid' : 'invalid';
			} catch {
				return 'unavailable';
			}
		}
	};
}
