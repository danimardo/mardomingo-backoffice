// Cambio de contraseña de la cuenta autenticada (W27; T266). Better Auth comprueba la contraseña actual y, con
// `revokeOtherSessions`, cierra las demás sesiones. Una contraseña actual errónea no cambia nada y se registra como rechazo.
// Tras cambiarla se anulan los enlaces de recuperación y los cambios de email pendientes (C-15, C-20) y se avisa al titular (C-18).
// Los intentos se limitan con el contador de sesión de la cuenta (compartido con el cambio de email y el borrado), con el umbral y
// el bloqueo del login (BE-FR-45, BE-FR-67; C-24; ver `password-attempts.ts`): con el
// bloqueo vigente, o con el fallo que alcanza el umbral, se lanza `LOGIN_TEMPORARILY_LOCKED` con los minutos que faltan.
import { randomUUID } from 'node:crypto';
import { immediateTransaction } from '$lib/server/db/tx';
import { sendAccountEmail } from '$lib/server/features/notifications';
import { AppError } from '$lib/server/shared/errors';
import { lockReachedBy, reservePasswordAttempt, sessionAttemptKeyOf } from './password-attempts';
import { deletePendingEmailChanges, deleteResetTokens } from './pending-tokens';
import { revokedSince, sessionIdsOf } from './close-session';
import { clearLoginAttempts } from './repository';
import { headersFor, type AccountsDeps } from './service';

/** Código de Better Auth de «contraseña actual incorrecta» (su mensaje varía entre versiones; se acepta ambos). */
const WRONG_CURRENT =
	/INVALID_PASSWORD|Invalid password|INVALID_EMAIL_OR_PASSWORD|Invalid email or password/i;

function codeOf(error: unknown): string {
	if (!(error instanceof Error)) return '';
	const body = 'body' in error ? error.body : undefined;
	if (
		typeof body === 'object' &&
		body !== null &&
		'code' in body &&
		typeof body.code === 'string'
	) {
		return body.code;
	}
	return error.message;
}

/** Solo la credencial de la petición más la IP real: la cabecera interna de la IP nunca la fija el cliente (C-35). */
function authHeadersOf(request: Headers, remoteIp: string | null): Headers {
	const headers = headersFor(remoteIp);
	const cookie = request.get('cookie');
	if (cookie !== null) headers.set('cookie', cookie);
	const authorization = request.get('authorization');
	if (authorization !== null) headers.set('authorization', authorization);
	return headers;
}

export async function changePassword(
	deps: AccountsDeps,
	headers: Headers,
	input: {
		readonly currentPassword: string;
		readonly newPassword: string;
		readonly remoteIp?: string | null;
	}
): Promise<'changed' | 'wrong_password'> {
	const current = await deps.auth.api.getSession({ headers });
	if (current === null) throw new AppError('UNAUTHENTICATED');

	// Reserva atómica antes de comprobar la contraseña actual (C-24, como C-16 en el login).
	const attempt = reservePasswordAttempt(deps, sessionAttemptKeyOf(deps, current.user.id));
	if (attempt.kind === 'locked') {
		deps.logger.emit('accounts.password.change_rejected', { reason: 'locked' });
		throw new AppError('LOGIN_TEMPORARILY_LOCKED', {
			retryAfterMinutes: attempt.retryAfterMinutes
		});
	}

	const sessionsBefore = sessionIdsOf(deps.db, current.user.id);
	let owner: { readonly id: string; readonly email: string };
	try {
		const result = await deps.auth.api.changePassword({
			headers: authHeadersOf(headers, input.remoteIp ?? null),
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true
			}
		});
		owner = { id: result.user.id, email: result.user.email };
	} catch (error) {
		// Un error inesperado deja el intento contado (falla cerrado; ver `password-attempts.ts`).
		if (!WRONG_CURRENT.test(codeOf(error))) throw error;
		const lockMinutes = lockReachedBy(attempt);
		if (lockMinutes !== null) {
			deps.logger.emit('accounts.password.change_rejected', { reason: 'locked' });
			throw new AppError('LOGIN_TEMPORARILY_LOCKED', { retryAfterMinutes: lockMinutes });
		}
		deps.logger.emit('accounts.password.change_rejected', { reason: 'wrong_password' });
		return 'wrong_password';
	}
	immediateTransaction(deps.db, (tx) => {
		clearLoginAttempts(tx, attempt.key);
		deleteResetTokens(tx, owner.id);
		deletePendingEmailChanges(tx, owner.id);
	});
	await sendAccountEmail(deps.notifications, {
		reason: 'password_changed',
		to: owner.email,
		idempotencyKey: randomUUID()
	});
	const count = revokedSince(deps.db, owner.id, sessionsBefore);
	deps.logger.emit('accounts.password.changed', { count });
	deps.logger.emit('accounts.session.revoked', { reason: 'password_changed', count });
	return 'changed';
}
