// API pública de `accounts` (ARCHITECTURE.md §4). `createAccounts` monta Better Auth con sus callbacks de email y
// devuelve los casos de uso ya enlazados a sus dependencias. La composición lo llama una vez, en `init`.
import { createHash } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { CaptchaVerifier } from '$lib/server/adapters/turnstile/captcha-verifier';
import type { Db } from '$lib/server/db/client';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import type { AppsDeps } from '$lib/server/features/apps';
import type { LegalDeps } from '$lib/server/features/legal';
import { sendAccountEmail, type NotificationsDeps } from '$lib/server/features/notifications';
import { createAuth, type Auth } from './auth';
import {
	login,
	logout,
	promoteAdminIfEligible,
	readSession,
	register,
	requestPasswordReset,
	resendVerification,
	resetPassword,
	verifyEmail,
	type AccountsBase,
	type AccountsDeps,
	type LoginInput,
	type RegisterInput
} from './service';

export { seedDisposableDomains } from './service';
export { accessFor, denialOf, type Access, type Requirement, type SessionUser } from './guards';
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
	readonly emailHashKey: string;
	readonly adminEmail: string | null;
	readonly authSecret: string;
	/** Origen público de la web: `BETTER_AUTH_URL` y base de los enlaces de los emails. */
	readonly publicWebUrl: string;
	/** Solo en la web: escribe la cookie desde las actions. */
	readonly requestEvent?: () => RequestEvent;
}

export interface Accounts {
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
	readSession(headers: Headers): ReturnType<typeof readSession>;
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
		adminEmail: config.adminEmail
	};

	const auth = createAuth({
		db: config.db,
		secret: config.authSecret,
		baseUrl: config.publicWebUrl,
		sendVerification: async (email, _userId, token) => {
			await sendAccountEmail(config.notifications, {
				reason: 'verification',
				to: email,
				link: linkTo(config.publicWebUrl, '/verificar', token),
				idempotencyKey: keyOf('verification', token)
			});
		},
		sendPasswordReset: async (email, _userId, token) => {
			await sendAccountEmail(config.notifications, {
				reason: 'password_reset',
				to: email,
				link: linkTo(config.publicWebUrl, '/recuperar/nueva', token),
				idempotencyKey: keyOf('password-reset', token)
			});
		},
		onEmailVerified: (userId, email) => {
			promoteAdminIfEligible(base, userId, email);
		},
		...(config.requestEvent === undefined ? {} : { requestEvent: config.requestEvent })
	});

	const deps: AccountsDeps = { ...base, auth };
	return {
		auth,
		register: (input) => register(deps, input),
		resendVerification: (input) => resendVerification(deps, input),
		verifyEmail: (token) => verifyEmail(deps, token),
		login: (input) => login(deps, input),
		requestPasswordReset: (input) => requestPasswordReset(deps, input),
		resetPassword: (input) => resetPassword(deps, input),
		logout: (headers) => logout(deps, headers),
		readSession: (headers) => readSession(deps, headers)
	};
}
