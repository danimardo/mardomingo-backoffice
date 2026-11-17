// Intentos con contraseña limitados (BE-FR-45, BE-FR-67; C-16, C-24). Hay dos contadores en `login_attempts`, con el mismo umbral
// (`login_max_failures`), la misma ventana de 15 minutos y el mismo bloqueo (`login_lock_minutes`):
// - el del login, por email normalizado (`loginAttemptKeyOf`), exista o no la cuenta;
// - el de las operaciones dentro de la sesión que piden la contraseña actual (cambio de contraseña, cambio de email y borrado
//   de cuenta), por cuenta (`sessionAttemptKeyOf`). Va aparte para que fallar logins con el email de alguien no le impida
//   cambiar la contraseña desde su sesión, ni al revés. Cada acierto pone a cero solo su contador.
//
// El intento se reserva en una transacción síncrona ANTES de comprobar la contraseña (que es asíncrona): cuenta como fallo
// provisional, así que las peticiones simultáneas no pueden pasar del umbral. Después, quien llama lo liquida:
// - acierto: `clearLoginAttempts` pone su contador a cero (BE-FR-67 CA2);
// - contraseña errónea: no hay nada que hacer, el fallo ya está contado;
// - la contraseña era correcta pero la operación no sigue (cuenta sin verificar o bloqueada): `refundPasswordAttempt`;
// - error inesperado: el intento queda contado (falla cerrado). Un error que no dice nada de la contraseña no debe abrir
//   intentos gratis; a quien lo sufra solo le cuesta un intento de los de la ventana.
import { createHmac } from 'node:crypto';
import { immediateTransaction } from '$lib/server/db/tx';
import { getSetting } from '$lib/server/features/apps';
import { AppError } from '$lib/server/shared/errors';
import type { EpochMs } from '$lib/shared/time';
import { isLoginLocked, minutesUntilUnlock, type LoginAttemptResult } from './domain/abuse';
import { normalizeEmail } from './domain/email';
import { hashNormalizedEmail } from './email-hash';
import { releaseLoginAttempt, reserveLoginAttempt } from './repository';
import type { AccountsBase } from './service';

const WINDOW_MINUTES = 15;

type Deps = Pick<AccountsBase, 'db' | 'clock' | 'apps' | 'emailHashKey'>;

export type PasswordAttempt =
	| { readonly kind: 'locked'; readonly failures: number; readonly retryAfterMinutes: number }
	| {
			readonly kind: 'reserved';
			/** Clave del contador en `login_attempts`. */
			readonly key: string;
			readonly now: EpochMs;
			readonly state: LoginAttemptResult;
	  };

function limit(deps: Deps, key: 'login_max_failures' | 'login_lock_minutes'): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return value;
}

/** Prefijo de las claves del contador de sesión: no se confunden con las del login, que son 64 caracteres hexadecimales. */
const SESSION_KEY_PREFIX = 'session:';

/** Clave del contador del login: HMAC del email normalizado (D-11), exista o no la cuenta (BE-FR-67 CA1). */
export function loginAttemptKeyOf(deps: Deps, email: string): string {
	return hashNormalizedEmail(normalizeEmail(email), deps.emailHashKey);
}

/**
 * Clave del contador de las operaciones de sesión: `session:` más el HMAC del id de la cuenta con la misma clave que el email
 * (D-11), así que la tabla no guarda identificadores en claro. No depende del email: sigue siendo la misma tras un cambio de
 * email.
 */
export function sessionAttemptKeyOf(deps: Deps, userId: string): string {
	const digest = createHmac('sha256', deps.emailHashKey)
		.update(`user:${userId}`, 'utf8')
		.digest('hex');
	return `${SESSION_KEY_PREFIX}${digest}`;
}

/** Reserva el intento antes de comprobar la contraseña. Con un bloqueo vigente no suma nada y dice cuánto falta. */
export function reservePasswordAttempt(deps: Deps, key: string): PasswordAttempt {
	const now = deps.clock.now();
	const outcome = immediateTransaction(deps.db, (tx) =>
		reserveLoginAttempt(tx, key, now, {
			maxFailures: limit(deps, 'login_max_failures'),
			lockMinutes: limit(deps, 'login_lock_minutes'),
			windowMinutes: WINDOW_MINUTES
		})
	);
	if (outcome.kind === 'locked') {
		return {
			kind: 'locked',
			failures: outcome.failures,
			retryAfterMinutes: minutesUntilUnlock(outcome.lockedUntil, now)
		};
	}
	return { kind: 'reserved', key, now, state: outcome.state };
}

/** Minutos de bloqueo si este intento, ya fallido, alcanzó el umbral; `null` si no lo alcanzó. */
export function lockReachedBy(
	attempt: Extract<PasswordAttempt, { kind: 'reserved' }>
): number | null {
	return isLoginLocked(attempt.state.lockedUntil, attempt.now)
		? minutesUntilUnlock(attempt.state.lockedUntil, attempt.now)
		: null;
}

/** Devuelve el intento: la contraseña era correcta, aunque la operación no siga. */
export function refundPasswordAttempt(
	deps: Deps,
	attempt: Extract<PasswordAttempt, { kind: 'reserved' }>
): void {
	immediateTransaction(deps.db, (tx) => {
		releaseLoginAttempt(tx, attempt.key, attempt.state);
	});
}
