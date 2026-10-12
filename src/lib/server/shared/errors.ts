// Códigos de error tipados. Los de la API vienen de Historias.md 7.2; los de la web, de
// contracts/web-routes.md. El estado HTTP de cada código es la única fuente de verdad: el
// formateador de errores de la API (`$lib/server/api`) lo usa tal cual.

export const ERROR_CODES = Object.freeze({
	// API (Historias.md 7.2)
	VALIDATION_ERROR: 400,
	UNKNOWN_APP: 400,
	UNAUTHENTICATED: 401,
	INVALID_CREDENTIALS: 401,
	INSUFFICIENT_BALANCE: 402,
	DAILY_FREE_LIMIT_REACHED: 402,
	EMAIL_NOT_VERIFIED: 403,
	ACCOUNT_BLOCKED: 403,
	TERMS_ACCEPTANCE_REQUIRED: 403,
	ORIGIN_NOT_ALLOWED: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	REQUEST_IN_PROGRESS: 409,
	DUPLICATE_REQUEST: 409,
	SYNC_CONFLICT: 412,
	PAYLOAD_TOO_LARGE: 413,
	AUDIO_TOO_LONG: 413,
	OPERATION_TOO_EXPENSIVE: 413,
	UPGRADE_REQUIRED: 426,
	RATE_LIMITED: 429,
	LOGIN_TEMPORARILY_LOCKED: 429,
	INTERNAL_ERROR: 500,
	PROVIDER_ERROR: 502,
	TRANSCRIPTION_FAILED: 502,
	MAINTENANCE: 503,
	SERVICE_LIMITED: 503,
	APP_DISABLED: 503,
	PROVIDER_TIMEOUT: 504,
	// Web (contracts/web-routes.md)
	FORBIDDEN: 403,
	WRONG_PASSWORD: 400,
	SESSION_NOT_FOUND: 404,
	SESSION_EXPIRED: 401,
	CAPTCHA_INVALID: 400,
	DISPOSABLE_DOMAIN: 400,
	TOKEN_EXPIRED: 400,
	TOKEN_USED: 400,
	TOKEN_INVALID: 400,
	SLUG_TAKEN: 409,
	ALREADY_BLOCKED: 409,
	PACK_INACTIVE: 409,
	PURCHASE_NOT_AVAILABLE: 403,
	LEGAL_VERSION_CHANGED: 409,
	PAYMENT_NOT_REFUNDABLE: 409,
	NOTHING_SELECTED: 400,
	BILLING_PROFILE_INCOMPLETE: 400,
	PAYMENT_PROVIDER_ERROR: 502,
	REGISTRATION_IP_LIMIT: 429
} as const satisfies Record<string, number>);

export type ErrorCode = keyof typeof ERROR_CODES;

/** Comprueba en tiempo de ejecución que una cadena es un código de error conocido. */
export function isErrorCode(value: string): value is ErrorCode {
	return Object.hasOwn(ERROR_CODES, value);
}

export const ERROR_CODE_LIST: readonly ErrorCode[] = Object.freeze(
	Object.keys(ERROR_CODES).filter(isErrorCode)
);

/** Error de aplicación con código tipado. Los detalles nunca incluyen secretos ni contenido. */
export class AppError extends Error {
	readonly code: ErrorCode;
	readonly status: number;
	readonly details: Readonly<Record<string, unknown>>;

	constructor(code: ErrorCode, details: Readonly<Record<string, unknown>> = {}) {
		super(code);
		this.name = 'AppError';
		this.code = code;
		this.status = ERROR_CODES[code];
		this.details = details;
	}
}
