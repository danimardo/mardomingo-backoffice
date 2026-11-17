// Cambio de contraseña de la cuenta autenticada (W27; T266). Better Auth comprueba la contraseña actual y, con
// `revokeOtherSessions`, cierra las demás sesiones. Una contraseña actual errónea no cambia nada y se registra como rechazo.
// Tras cambiarla se anulan los enlaces de recuperación y los cambios de email pendientes (C-15, C-20) y se avisa al titular (C-18).
import { randomUUID } from 'node:crypto';
import { immediateTransaction } from '$lib/server/db/tx';
import { sendAccountEmail } from '$lib/server/features/notifications';
import { deletePendingEmailChanges, deleteResetTokens } from './pending-tokens';
import type { AccountsDeps } from './service';

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

export async function changePassword(
	deps: AccountsDeps,
	headers: Headers,
	input: { readonly currentPassword: string; readonly newPassword: string }
): Promise<'changed' | 'wrong_password'> {
	let owner: { readonly id: string; readonly email: string };
	try {
		const result = await deps.auth.api.changePassword({
			headers,
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true
			}
		});
		owner = { id: result.user.id, email: result.user.email };
	} catch (error) {
		if (WRONG_CURRENT.test(codeOf(error))) {
			deps.logger.emit('accounts.password.change_rejected', { reason: 'wrong_password' });
			return 'wrong_password';
		}
		throw error;
	}
	immediateTransaction(deps.db, (tx) => {
		deleteResetTokens(tx, owner.id);
		deletePendingEmailChanges(tx, owner.id);
	});
	await sendAccountEmail(deps.notifications, {
		reason: 'password_changed',
		to: owner.email,
		idempotencyKey: randomUUID()
	});
	deps.logger.emit('accounts.password.changed', { count: 1 });
	return 'changed';
}
