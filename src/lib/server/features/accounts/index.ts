// API pública de `accounts` (ARCHITECTURE.md §4). `createAccounts` monta Better Auth con sus callbacks de email y
// devuelve los casos de uso ya enlazados a sus dependencias. La composición lo llama una vez, en `init`.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { CaptchaVerifier } from '$lib/server/adapters/turnstile/captcha-verifier';
import type { Db } from '$lib/server/db/client';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import type { EpochMs } from '$lib/shared/time';
import type { AppsDeps } from '$lib/server/features/apps';
import type { Credits } from '$lib/server/features/credits';
import { hashNormalizedEmail } from './email-hash';
import { normalizeEmail } from './domain/email';
import type { LegalDeps } from '$lib/server/features/legal';
import { createEmailDispatcher } from './email-dispatch';
import { sendAccountEmail, type NotificationsDeps } from '$lib/server/features/notifications';
import { createAuth, type Auth } from './auth';
import {
	login,
	loginFromApp,
	logout,
	promoteAdminIfEligible,
	readSession,
	register,
	requestPasswordReset,
	resendVerification,
	resetPassword,
	verifyEmail,
	resetTokenStateOf,
	verificationTokenStateOf,
	type AccountsBase,
	type AccountsDeps,
	type LoginInput,
	touchAppSession,
	type AppLoginInput,
	type AppLoginResult,
	type RegisterInput
} from './service';

export { blockAccount, seedDisposableDomains } from './service';
import { changePassword } from './password-change';
import {
	anonymizeUser,
	clearSessionCookie,
	checkCurrentPassword,
	exportProfile,
	revokeAllSessions,
	type PasswordCheck,
	type ProfileExport
} from './erasure';
export type { PasswordCheck, ProfileExport } from './erasure';
import {
	confirmEmailChange,
	requestEmailChange,
	type EmailChangeConfirmOutcome,
	type EmailChangeRequestOutcome
} from './email-change';
import {
	clearInactivityWarning,
	inactivityCandidates,
	markInactivityWarned,
	purgeAuthAttempts,
	purgeExpiredSessions,
	purgeExpiredVerifications,
	purgeUnverified,
	type InactivityCandidate
} from './retention';
export type { InactivityCandidate } from './retention';
export { sessionsOf, type SessionView } from './sessions';
export { sessionDtoOf, type SessionDto } from './presenters';
export { closeOtherSession, closeOtherSessions } from './close-session';
export { emailOfUser, signupAppIdOf } from './user-email';
export { appsUsedBy } from './apps-used';
export { touchActivity } from './activity';
export type { EmailChangeConfirmOutcome, EmailChangeRequestOutcome } from './email-change';
export { accessFor, denialOf, type Access, type Requirement, type SessionUser } from './guards';
export type { AppLoginInput, AppLoginResult } from './service';
import { denialOf, type Access, type SessionUser } from './guards';
export {
	AppLoginBody,
	AppLoginResponse,
	PendingAcceptanceSchema,
	ResendVerificationBody
} from './contract';
export { ACCOUNTS_LOG_EVENTS, type AccountsLogFields } from './events';
export { normalizeEmail } from './domain/email';
export type { AccountsBase, LoginInput, RegisterInput };

export interface AccountsConfig {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly captcha: CaptchaVerifier;
	readonly notifications: NotificationsDeps;
	readonly apps: AppsDeps;
	readonly legal: LegalDeps;
	/** Bolsa de bienvenida al verificar (BE-FR-12, D-20): `accounts` → `credits`. */
	readonly credits: Credits;
	readonly emailHashKey: string;
	readonly adminEmail: string | null;
	readonly authSecret: string;
	/** Origen público de la web: `BETTER_AUTH_URL` y base de los enlaces de los emails. */
	readonly publicWebUrl: string;
	/** Solo en la web: escribe la cookie desde las actions. */
	readonly requestEvent?: () => RequestEvent;
}

/** Qué tipo de token se consulta: el de verificación (JWT) o el de recuperación (opaco en Better Auth). */
export type TokenKind = 'verification' | 'reset';

export interface Accounts {
	/**
	 * Comprueba la contraseña actual para confirmar acciones destructivas (BE-FR-07), con el contador de sesión de la cuenta
	 * (BE-FR-45, BE-FR-67; C-24), aparte del login: `locked` con los minutos que faltan si se ha superado.
	 */
	checkCurrentPassword(userId: string, password: string): Promise<PasswordCheck>;
	/** Borrado de la cuenta: cierra todas las sesiones de todas las apps. Solo `privacy`. */
	revokeAllSessions(userId: string): number;
	/** Borrado de la cuenta: anonimiza `user` y borra credenciales, tokens y actividad. Solo `privacy`. */
	anonymizeUser(userId: string): boolean;
	/** Borra la cookie de sesión de la petición tras borrar la cuenta (W29). */
	clearSessionCookie(headers: Headers): Promise<void>;
	/** Limpieza de cuentas sin verificar con más de `ttlDays` días: borrado físico (BE-FR-68). */
	purgeUnverified(ttlDays: number): number;
	/** Retención (BE-FR-83): sesiones caducadas antes del corte. Solo `privacy`. */
	purgeExpiredSessions(before: EpochMs): number;
	/** Retención: contadores de límites por IP e intentos de login antiguos, sin bloqueo vigente. Solo `privacy`. */
	purgeAuthAttempts(before: EpochMs): number;
	/** Retención: tokens de verificación y recuperación caducados antes del corte. Solo `privacy`. */
	purgeExpiredVerifications(before: EpochMs): number;
	/** Cuentas que pueden estar inactivas o ya avisadas (BE-FR-86). Solo `privacy`. */
	inactivityCandidates(cutoff: EpochMs): InactivityCandidate[];
	markInactivityWarned(userId: string, at: EpochMs): void;
	clearInactivityWarning(userId: string): void;
	/** Perfil y dispositivos para la exportación RGPD (BE-FR-08). */
	exportProfile(userId: string): ProfileExport | null;
	/**
	 * Pide el cambio de email: contraseña actual, enlace de 24 h a la dirección nueva (W27, T266). Superado el límite de intentos
	 * de sesión de la cuenta lanza `AppError('LOGIN_TEMPORARILY_LOCKED')` con `retryAfterMinutes` (C-24).
	 */
	requestEmailChange(input: {
		readonly userId: string;
		readonly currentPassword: string;
		readonly newEmail: string;
		readonly remoteIp: string | null;
	}): Promise<EmailChangeRequestOutcome>;
	/** Aplica el cambio desde el enlace de W14: cierra las sesiones salvo la actual y avisa a la dirección anterior (T266, C-19). */
	confirmEmailChange(
		token: string,
		currentSessionId?: string | null
	): Promise<EmailChangeConfirmOutcome>;
	/**
	 * Cambio de contraseña con la actual; cierra las demás sesiones (W27, T266). Superado el límite de intentos de sesión
	 * de la cuenta lanza `AppError('LOGIN_TEMPORARILY_LOCKED')` con `retryAfterMinutes` (C-24).
	 */
	changePassword(
		headers: Headers,
		input: { readonly currentPassword: string; readonly newPassword: string }
	): Promise<'changed' | 'wrong_password'>;
	register(input: RegisterInput): Promise<{ readonly sentTo: string }>;
	resendVerification(input: {
		readonly email: string;
		readonly remoteIp: string | null;
	}): Promise<void>;
	verifyEmail(token: string): Promise<{ readonly userId: string }>;
	login(input: LoginInput): Promise<{ readonly redirectTo: string }>;
	requestPasswordReset(input: {
		readonly email: string;
		readonly remoteIp: string | null;
	}): Promise<void>;
	resetPassword(input: { readonly token: string; readonly password: string }): Promise<void>;
	logout(headers: Headers): Promise<void>;
	loginFromApp(input: AppLoginInput): Promise<AppLoginResult>;
	touchAppSession(input: {
		readonly sessionId: string;
		readonly userId: string;
		readonly appId: string;
	}): void;
	/** Estado sin consumir el token: `verification` (JWT, con «used») o `reset` (opaco, «valid» o «invalid»). */
	tokenState(token: string, kind: TokenKind): 'valid' | 'used' | 'invalid';
	readSession(headers: Headers): ReturnType<typeof readSession>;
	/** Solo pruebas: espera a que terminen los emails de cuenta enviados sin esperar (C-17). */
	drainEmails(): Promise<void>;
	auth: Auth;
}

/** Enlace de un email de la cuenta: la ruta propia de la web y el token, codificado (R02). */
function linkTo(publicWebUrl: string, path: string, token: string): string {
	return `${publicWebUrl}${path}?token=${encodeURIComponent(token)}`;
}

/** Clave de idempotencia de un email de verificación o recuperación: el mismo token es el mismo envío. */
function keyOf(kind: string, token: string): string {
	return `${kind}-${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

export function createAccounts(config: AccountsConfig): Accounts {
	const emails = createEmailDispatcher(config.logger);
	const base: AccountsBase = {
		db: config.db,
		logger: config.logger,
		clock: config.clock,
		ids: config.ids,
		captcha: config.captcha,
		notifications: config.notifications,
		apps: config.apps,
		legal: config.legal,
		emailHashKey: config.emailHashKey,
		adminEmail: config.adminEmail,
		emails
	};

	const auth = createAuth({
		db: config.db,
		secret: config.authSecret,
		baseUrl: config.publicWebUrl,
		// Better Auth espera la promesa del callback: el envío se lanza sin esperarlo (C-17).
		sendVerification: (email, _userId, token) => {
			emails.dispatch(() =>
				sendAccountEmail(config.notifications, {
					reason: 'verification',
					to: email,
					link: linkTo(config.publicWebUrl, '/verificar', token),
					idempotencyKey: keyOf('verification', token)
				})
			);
			return Promise.resolve();
		},
		sendPasswordReset: (email, _userId, token) => {
			emails.dispatch(() =>
				sendAccountEmail(config.notifications, {
					reason: 'password_reset',
					to: email,
					link: linkTo(config.publicWebUrl, '/recuperar/nueva', token),
					idempotencyKey: keyOf('password-reset', token)
				})
			);
			return Promise.resolve();
		},
		onEmailVerified: (userId, email) => {
			promoteAdminIfEligible(base, userId, email);
			// Transacción propia de `credits`: la bienvenida se concede una vez por forma normalizada (BE-FR-11.5).
			config.credits.grantWelcome({
				userId,
				emailNormalizedHash: hashNormalizedEmail(normalizeEmail(email), config.emailHashKey)
			});
		},
		...(config.requestEvent === undefined ? {} : { requestEvent: config.requestEvent })
	});

	const deps: AccountsDeps = { ...base, auth };
	return {
		auth,
		drainEmails: () => emails.drain(),
		changePassword: (headers, input) => changePassword(deps, headers, input),
		checkCurrentPassword: (userId, password) => checkCurrentPassword(deps, userId, password),
		revokeAllSessions: (userId) => revokeAllSessions(deps, userId),
		anonymizeUser: (userId) => anonymizeUser(deps, userId),
		clearSessionCookie: (headers) => clearSessionCookie(deps, headers),
		exportProfile: (userId) => exportProfile(deps, userId),
		purgeUnverified: (ttlDays) => purgeUnverified(deps, ttlDays),
		purgeExpiredSessions: (before) => purgeExpiredSessions(deps, before),
		purgeAuthAttempts: (before) => purgeAuthAttempts(deps, before),
		purgeExpiredVerifications: (before) => purgeExpiredVerifications(deps, before),
		inactivityCandidates: (cutoff) => inactivityCandidates(deps, cutoff),
		markInactivityWarned: (userId, at) => {
			markInactivityWarned(deps, userId, at);
		},
		clearInactivityWarning: (userId) => {
			clearInactivityWarning(deps, userId);
		},
		requestEmailChange: (input) =>
			requestEmailChange(deps, { ...input, publicWebUrl: config.publicWebUrl }),
		confirmEmailChange: (token, currentSessionId) =>
			Promise.resolve(confirmEmailChange(deps, token, currentSessionId ?? null)),
		register: (input) => register(deps, input),
		resendVerification: (input) => resendVerification(deps, input),
		verifyEmail: (token) => verifyEmail(deps, token),
		login: (input) => login(deps, input),
		requestPasswordReset: (input) => requestPasswordReset(deps, input),
		resetPassword: (input) => resetPassword(deps, input),
		logout: (headers) => logout(deps, headers),
		loginFromApp: (input) => loginFromApp(deps, input),
		touchAppSession: (input) => {
			touchAppSession(deps, input);
		},
		tokenState: (token, kind) =>
			kind === 'reset' ? resetTokenStateOf(deps, token) : verificationTokenStateOf(deps, token),
		readSession: (headers) => readSession(deps, headers)
	};
}

const SESSION_USER = z.object({
	id: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	banned: z.boolean().nullish(),
	role: z.string().nullish()
});

/** Usuario de la sesión en la forma que usan los guards; `null` si la forma no encaja. */
export function sessionUserOf(raw: unknown): SessionUser | null {
	const parsed = SESSION_USER.safeParse(raw);
	if (!parsed.success) return null;
	return {
		id: parsed.data.id,
		email: parsed.data.email,
		emailVerified: parsed.data.emailVerified,
		banned: parsed.data.banned === true,
		role: parsed.data.role ?? 'user'
	};
}
/**
 * Registra en `accounts.guard.denied` una denegación del guard (motivo y estado HTTP, sin datos personales). Las rutas la
 * llaman antes de redirigir; un acceso permitido no hace nada.
 */
export function reportDenial(logger: Logger, access: Access): void {
	const denial = denialOf(access);
	if (denial !== null) logger.emit('accounts.guard.denied', denial);
}

export { safeRedirect } from './domain/redirect';

// Administración de usuarios (T305–T306). Las dependencias incluyen la auditoría; las llama solo la composición (W34–W35).
export {
	blockUser,
	closeUserSessions,
	searchUsers,
	setTester,
	unblockUser,
	userCount,
	verifiedUserEmails,
	accountView,
	type AccountView,
	ADMIN_USERS_PAGE_SIZE,
	type AdminUsersDeps,
	type UserRow,
	type UserSearchPage
} from './admin-users';

// Altas, primeros inicios de sesión y cuentas activas para estadísticas (BE-FR-54; T318). Solo lectura.
export {
	activeUsersBetween,
	firstLoginsBetween,
	signupsBetween,
	type FirstLoginFact,
	type SignupFact
} from './stats-facts';

// Refresco de la lista de dominios desechables (T340).
export { applyDisposableDomains } from './disposable-refresh';
