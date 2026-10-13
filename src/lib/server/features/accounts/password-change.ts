// Cambio de contraseña de la cuenta autenticada (W27; T266). Better Auth comprueba la contraseña actual y, con
// `revokeOtherSessions`, cierra las demás sesiones. Una contraseña actual errónea no cambia nada y se registra como rechazo.
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
	try {
		await deps.auth.api.changePassword({
			headers,
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true
			}
		});
	} catch (error) {
		if (WRONG_CURRENT.test(codeOf(error))) {
			deps.logger.emit('accounts.password.change_rejected', { reason: 'wrong_password' });
			return 'wrong_password';
		}
		throw error;
	}
	deps.logger.emit('accounts.password.changed', { count: 1 });
	return 'changed';
}
