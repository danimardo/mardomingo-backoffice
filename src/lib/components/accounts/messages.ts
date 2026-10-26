// Textos de los errores de la cuenta, por código del catálogo (contracts/web-routes.md 1.4). Solo se usan textos de
// Paraglide: ninguna acción escribe un mensaje suelto. Un código sin texto propio cae en el genérico.
import * as m from '$lib/paraglide/messages.js';

/** Texto visible de un código de error de la web. */
export function formErrorText(code: string, retryAfterMinutes?: number): string {
	switch (code) {
		case 'CAPTCHA_INVALID':
			return m.accounts_error_captcha();
		case 'DISPOSABLE_DOMAIN':
			return m.accounts_error_disposable();
		case 'REGISTRATION_IP_LIMIT':
			return m.accounts_error_ip_limit();
		case 'LEGAL_VERSION_CHANGED':
			return m.accounts_error_legal_changed();
		case 'INVALID_CREDENTIALS':
			return m.accounts_login_invalid();
		case 'EMAIL_NOT_VERIFIED':
			return m.accounts_login_not_verified();
		case 'ACCOUNT_BLOCKED':
			return m.accounts_login_blocked();
		case 'LOGIN_TEMPORARILY_LOCKED':
			return m.accounts_login_locked({ minutes: String(retryAfterMinutes ?? 15) });
		case 'TOKEN_EXPIRED':
			return m.accounts_verify_expired();
		case 'TOKEN_USED':
			return m.accounts_verify_used();
		case 'TOKEN_INVALID':
			return m.accounts_verify_invalid();
		case 'UNAUTHENTICATED':
		case 'SESSION_EXPIRED':
			return m.accounts_login_notice_session_expired();
		case 'WRONG_PASSWORD':
			return m.errors_wrong_password();
		case 'RATE_LIMITED':
			return retryAfterMinutes === undefined
				? m.errors_rate_limited()
				: m.errors_rate_limited_minutes({ minutes: String(retryAfterMinutes) });
		case 'VALIDATION_ERROR':
			return m.validation_invalid();
		default:
			return m.errors_unexpected();
	}
}
