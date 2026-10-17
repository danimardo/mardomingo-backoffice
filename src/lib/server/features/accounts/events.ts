// Catálogo de eventos de `accounts` (contracts/log-events.md 3.8; T099): prefijo `accounts`. Ningún evento lleva
// email, IP ni fecha (Historias 15.19): solo el motivo, el estado o un recuento.
import type { LogEventMeta } from '$lib/server/logging/events';

export type SignupRejectReason =
	| 'validation'
	| 'captcha_invalid'
	| 'disposable_domain'
	| 'ip_limit'
	| 'email_exists'
	| 'legal_version_changed';

export interface AccountsLogFields {
	'accounts.signup.completed': Record<string, never>;
	'accounts.signup.rejected': { reason: SignupRejectReason };
	'accounts.captcha.unavailable': { provider: 'turnstile' };
	'accounts.email.verified': Record<string, never>;
	'accounts.verification.rejected': { reason: 'expired' | 'used' | 'invalid' };
	'accounts.verification.resend_requested': { status: 'sent' | 'suppressed' };
	'accounts.login.succeeded': { status: 'web' | 'app' };
	'accounts.login.failed': {
		reason: 'invalid_credentials' | 'not_verified' | 'blocked';
		errorCode: string;
	};
	'accounts.login.locked': { reason: 'too_many_failures'; count: number };
	'accounts.rate_limit.exceeded': {
		reason: 'login' | 'signup' | 'resend_verification' | 'password_reset' | 'email_change';
	};
	'accounts.session.rejected': {
		reason:
			'missing_token' | 'expired' | 'revoked' | 'other_app' | 'bearer_on_web' | 'cookie_on_api';
		errorCode: string;
	};
	'accounts.session.renewed': Record<string, never>;
	'accounts.session.revoked': {
		reason:
			| 'logout'
			| 'user_closed_one'
			| 'user_closed_others'
			| 'password_changed'
			| 'email_changed'
			| 'blocked'
			| 'account_deleted'
			| 'admin_closed';
		count?: number;
	};
	'accounts.password.reset_requested': { status: 'sent' | 'suppressed' };
	'accounts.password.reset_completed': Record<string, never>;
	'accounts.password.changed': { count: number };
	'accounts.password.change_rejected': { reason: 'wrong_password' | 'validation' };
	'accounts.email_change.requested': { status: 'sent' | 'suppressed' };
	'accounts.email_change.applied': { sessionsClosed: number };
	'accounts.email_change.rejected': {
		reason: 'wrong_password' | 'expired' | 'used' | 'invalid' | 'taken';
	};
	'accounts.user.blocked': { reason: 'admin' | 'chargeback' };
	'accounts.user.unblocked': Record<string, never>;
	'accounts.role.changed': { status: 'tester_on' | 'tester_off' | 'admin_on' };
	'accounts.admin.promoted': Record<string, never>;
	'accounts.admin.promotion_refused': { reason: 'admin_exists' };
	'accounts.guard.denied': { reason: 'anonymous' | 'unverified' | 'not_admin'; httpStatus: number };
	'accounts.unverified.purged': { count: number };
	'accounts.disposable_domains.refreshed': { count: number };
	'accounts.disposable_domains.refresh_failed': { httpStatus: number };
}

export const ACCOUNTS_LOG_EVENTS = Object.freeze({
	'accounts.signup.completed': { level: 'info', msg: 'Cuenta registrada' },
	'accounts.signup.rejected': { level: 'info', msg: 'Registro rechazado' },
	'accounts.captcha.unavailable': { level: 'warn', msg: 'Captcha no disponible' },
	'accounts.email.verified': { level: 'info', msg: 'Email verificado' },
	'accounts.verification.rejected': { level: 'info', msg: 'Verificación rechazada' },
	'accounts.verification.resend_requested': {
		level: 'info',
		msg: 'Reenvío de verificación solicitado'
	},
	'accounts.login.succeeded': { level: 'info', msg: 'Inicio de sesión correcto' },
	'accounts.login.failed': { level: 'info', msg: 'Inicio de sesión fallido' },
	'accounts.login.locked': { level: 'warn', msg: 'Login bloqueado temporalmente' },
	'accounts.rate_limit.exceeded': { level: 'warn', msg: 'Límite por IP de autenticación superado' },
	'accounts.session.rejected': { level: 'info', msg: 'Sesión rechazada' },
	'accounts.session.renewed': { level: 'debug', msg: 'Sesión renovada' },
	'accounts.session.revoked': { level: 'info', msg: 'Sesiones revocadas' },
	'accounts.password.reset_requested': { level: 'info', msg: 'Recuperación solicitada' },
	'accounts.password.reset_completed': { level: 'info', msg: 'Contraseña restablecida' },
	'accounts.password.changed': { level: 'info', msg: 'Contraseña cambiada' },
	'accounts.password.change_rejected': { level: 'info', msg: 'Cambio de contraseña rechazado' },
	'accounts.email_change.requested': { level: 'info', msg: 'Cambio de email solicitado' },
	'accounts.email_change.applied': { level: 'info', msg: 'Email cambiado' },
	'accounts.email_change.rejected': { level: 'info', msg: 'Cambio de email rechazado' },
	'accounts.user.blocked': { level: 'info', msg: 'Usuario bloqueado' },
	'accounts.user.unblocked': { level: 'info', msg: 'Usuario desbloqueado' },
	'accounts.role.changed': { level: 'info', msg: 'Rol cambiado' },
	'accounts.admin.promoted': { level: 'info', msg: 'Administrador promovido' },
	'accounts.admin.promotion_refused': {
		level: 'error',
		msg: 'Promoción de administrador rechazada'
	},
	'accounts.guard.denied': { level: 'info', msg: 'Acceso denegado por el guard' },
	'accounts.unverified.purged': { level: 'info', msg: 'Cuentas sin verificar eliminadas' },
	'accounts.disposable_domains.refreshed': {
		level: 'info',
		msg: 'Lista de dominios desechables actualizada'
	},
	'accounts.disposable_domains.refresh_failed': {
		level: 'warn',
		msg: 'No se pudo actualizar la lista de dominios desechables'
	}
} as const satisfies Record<keyof AccountsLogFields, LogEventMeta>);
