// Casos de uso de la cuenta (BE-FR-01 a BE-FR-06, BE-FR-11, BE-FR-67; contracts/web-routes.md W08–W15). Orquesta el
// antiabuso, Better Auth (`auth.api`), las aceptaciones legales y los emails. Las respuestas de registro, reenvío y
// recuperación son siempre neutras (no revelan si el email existe). Los errores de negocio son `AppError` con el código
// del catálogo; los errores de Better Auth se traducen en un único sitio (`betterAuthCode`).
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { CaptchaVerifier } from '$lib/server/adapters/turnstile/captcha-verifier';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { findActiveAppBySlug, getSetting, type AppsDeps } from '$lib/server/features/apps';
import { currentVersions, recordAcceptances, type LegalDeps } from '$lib/server/features/legal';
import { sendAccountEmail, type NotificationsDeps } from '$lib/server/features/notifications';
import type { Logger } from '$lib/server/logging/logger';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { Auth } from './auth';
import { DISPOSABLE_DOMAINS_V1 } from './disposable-domains';
import { normalizeEmail } from './domain/email';
import { safeRedirect } from './domain/redirect';
import { hashNormalizedEmail } from './email-hash';
import {
	bumpRateCounter,
	clearLoginAttempts,
	countSignupsFromIp,
	insertDisposableDomains,
	isDisposableDomain,
	readLoginAttempt,
	recordLoginFailure,
	setSignupMetadata
} from './repository';
import { user, verification } from './schema';

/** Lo que `accounts` necesita de la composición. El `Auth` se añade al montar el servicio (ver `index.ts`). */
export interface AccountsBase {
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
}

export interface AccountsDeps extends AccountsBase {
	readonly auth: Auth;
}

export interface RegisterInput {
	readonly email: string;
	readonly password: string;
	readonly captchaToken: string;
	readonly remoteIp: string | null;
	readonly appSlug: string | null;
	readonly versions: { readonly terms: string; readonly privacy: string; readonly aup: string };
	readonly ageDeclared: boolean;
}

export interface LoginInput {
	readonly email: string;
	readonly password: string;
	readonly redirectTo: string | undefined;
	readonly remoteIp: string | null;
}

const HOUR_MS = 60 * 60 * 1000;
const LOGIN_WINDOW_MINUTES = 15;

// ---------------------------------------------------------------------------------------------------------------------
// Errores de Better Auth: se leen en un único sitio y se traducen a códigos de la aplicación.

/** Código del cuerpo del error de Better Auth, o su mensaje si no trae cuerpo. */
function betterAuthCode(error: unknown): string {
	if (!(error instanceof Error)) return '';
	const body = 'body' in error ? error.body : undefined;
	if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string')
		return body.code;
	return error.message;
}

const isUserExists = (error: unknown): boolean =>
	/ALREADY_EXISTS|already exists/i.test(betterAuthCode(error));
const isNotVerified = (error: unknown): boolean =>
	/EMAIL_NOT_VERIFIED|Email not verified/i.test(betterAuthCode(error));
const isBanned = (error: unknown): boolean => /BANNED/i.test(betterAuthCode(error));
const isBadCredentials = (error: unknown): boolean =>
	/INVALID_EMAIL_OR_PASSWORD|Invalid email or password/i.test(betterAuthCode(error));
const isExpiredToken = (error: unknown): boolean => /expired|EXPIRED/.test(betterAuthCode(error));

/** Cabeceras para Better Auth: la IP del cliente va en la cabecera interna que lee `advanced.ipAddress` (R02). */
function headersFor(remoteIp: string | null): Headers {
	const headers = new Headers();
	if (remoteIp !== null) headers.set('x-mm-client-ip', remoteIp);
	return headers;
}

type NumericSetting =
	'registrations_per_ip_24h' | 'login_max_failures' | 'login_lock_minutes' | 'min_age';

function numberSetting(deps: AccountsBase, key: NumericSetting): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return value;
}

function emailDomain(email: string): string {
	const at = email.lastIndexOf('@');
	return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

function minutesLeft(lockedUntil: EpochMs, now: EpochMs): number {
	return Math.max(1, Math.ceil((lockedUntil - now) / 60_000));
}

// ---------------------------------------------------------------------------------------------------------------------
// Alta y verificación (W08–W10)

/** Registro (W08): captcha → dominio desechable → altas por IP → versiones legales → alta → aceptaciones → email. */
export async function register(
	deps: AccountsDeps,
	input: RegisterInput
): Promise<{ readonly sentTo: string }> {
	const now = deps.clock.now();
	const reject = (
		reason: 'captcha_invalid' | 'disposable_domain' | 'ip_limit' | 'legal_version_changed',
		code: ErrorCode
	): never => {
		deps.logger.emit('accounts.signup.rejected', { reason });
		throw new AppError(code);
	};

	const outcome = await deps.captcha.verify({
		token: input.captchaToken,
		remoteIp: input.remoteIp,
		idempotencyKey: randomUUID()
	});
	if (outcome === 'unavailable') {
		deps.logger.emit('accounts.captcha.unavailable', { provider: 'turnstile' });
		return reject('captcha_invalid', 'CAPTCHA_INVALID');
	}
	if (outcome === 'invalid') return reject('captcha_invalid', 'CAPTCHA_INVALID');

	if (isDisposableDomain(deps.db, emailDomain(input.email)))
		return reject('disposable_domain', 'DISPOSABLE_DOMAIN');

	if (
		input.remoteIp !== null &&
		countSignupsFromIp(deps.db, input.remoteIp, now) >=
			numberSetting(deps, 'registrations_per_ip_24h')
	) {
		return reject('ip_limit', 'REGISTRATION_IP_LIMIT');
	}

	const current = currentVersions(deps.legal, now, ['terms', 'privacy', 'aup']);
	const sameVersions =
		current.get('terms')?.version === input.versions.terms &&
		current.get('privacy')?.version === input.versions.privacy &&
		current.get('aup')?.version === input.versions.aup;
	if (!sameVersions) return reject('legal_version_changed', 'LEGAL_VERSION_CHANGED');

	let created: { readonly user: { readonly id: string } };
	try {
		created = await deps.auth.api.signUpEmail({
			body: { email: input.email, password: input.password, name: '' },
			headers: headersFor(input.remoteIp)
		});
	} catch (error) {
		// Anti-enumeración (BE-FR-01 CA5): si el email ya existe, la respuesta es la misma y no sale ningún email.
		if (isUserExists(error)) {
			deps.logger.emit('accounts.signup.rejected', { reason: 'email_exists' });
			return { sentTo: input.email };
		}
		throw error;
	}

	// Better Auth responde al alta de un email ya registrado con un usuario sintético, sin error (anti-enumeración con
	// verificación obligatoria). Si ese id no está en la base de datos, no hay cuenta nueva: misma respuesta, sin escribir.
	if (
		deps.db.select({ id: user.id }).from(user).where(eq(user.id, created.user.id)).get() ===
		undefined
	) {
		deps.logger.emit('accounts.signup.rejected', { reason: 'email_exists' });
		return { sentTo: input.email };
	}

	const appId =
		input.appSlug === null ? null : (findActiveAppBySlug(deps.apps, input.appSlug)?.id ?? null);
	const minAge = numberSetting(deps, 'min_age');
	immediateTransaction(deps.db, (tx: Tx) => {
		setSignupMetadata(tx, created.user.id, {
			emailNormalized: normalizeEmail(input.email),
			signupAppId: appId,
			signupIp: input.remoteIp
		});
		recordAcceptances(tx, deps.legal, {
			userId: created.user.id,
			appId: null,
			ip: input.remoteIp,
			now,
			accepted: [
				{ document: 'terms', version: input.versions.terms },
				{ document: 'privacy', version: input.versions.privacy },
				{ document: 'aup', version: input.versions.aup },
				...(input.ageDeclared
					? [{ document: 'age_declaration' as const, version: String(minAge) }]
					: [])
			]
		});
	});

	// El envío lo hace Better Auth con su token; el callback de `auth.ts` construye el enlace y lo entrega a notifications.
	await deps.auth.api.sendVerificationEmail({ body: { email: input.email } });
	deps.logger.emit('accounts.signup.completed', {});
	return { sentTo: input.email };
}

/** Reenvío de la verificación (W10): siempre neutro, y el contador por IP se lleva aunque no haya cuenta. */
export async function resendVerification(
	deps: AccountsDeps,
	input: { readonly email: string; readonly remoteIp: string | null }
): Promise<void> {
	const now = deps.clock.now();
	const ip = input.remoteIp;
	if (ip !== null) {
		immediateTransaction(deps.db, (tx) => {
			bumpRateCounter(tx, 'resend_verification', ip, now, HOUR_MS);
		});
	}
	const email = input.email.toLowerCase();
	const row = deps.db.select().from(user).where(eq(user.email, email)).get();
	const pending = row !== undefined && !row.emailVerified;
	if (pending) await deps.auth.api.sendVerificationEmail({ body: { email } });
	deps.logger.emit('accounts.verification.resend_requested', {
		status: pending ? 'sent' : 'suppressed'
	});
}

/** Email que el token de verificación lleva en su carga (sin verificar la firma: la verifica Better Auth al usarlo). */
function emailOfToken(token: string): string | undefined {
	const payload = token.split('.')[1];
	if (payload === undefined) return undefined;
	try {
		const parsed = z
			.object({ email: z.string() })
			.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
		return parsed.success ? parsed.data.email.toLowerCase() : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Verificación (W09). Better Auth valida la firma y el caducidad, y responde igual tanto al primer uso como al repetido
 * (`{ status: true, user: null }`), así que el «ya usado» se decide con el estado de la cuenta leído antes de llamarle.
 */
export async function verifyEmail(
	deps: AccountsDeps,
	token: string
): Promise<{ readonly userId: string }> {
	const email = emailOfToken(token);
	const before =
		email === undefined
			? undefined
			: deps.db
					.select({ id: user.id, emailVerified: user.emailVerified })
					.from(user)
					.where(eq(user.email, email))
					.get();
	try {
		await deps.auth.api.verifyEmail({ query: { token } });
	} catch (error) {
		const reason = isExpiredToken(error) ? 'expired' : 'invalid';
		deps.logger.emit('accounts.verification.rejected', { reason });
		throw new AppError(reason === 'expired' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
	}
	if (before === undefined) {
		deps.logger.emit('accounts.verification.rejected', { reason: 'invalid' });
		throw new AppError('TOKEN_INVALID');
	}
	if (before.emailVerified) {
		deps.logger.emit('accounts.verification.rejected', { reason: 'used' });
		throw new AppError('TOKEN_USED');
	}
	deps.logger.emit('accounts.email.verified', {});
	return { userId: before.id };
}

// ---------------------------------------------------------------------------------------------------------------------
// Login, recuperación y cierre (W11–W15)

/** Login web (W11): el bloqueo por intentos se lleva por email normalizado, exista o no la cuenta (BE-FR-67 CA1). */
export async function login(
	deps: AccountsDeps,
	input: LoginInput
): Promise<{ readonly redirectTo: string }> {
	const now = deps.clock.now();
	const hash = hashNormalizedEmail(normalizeEmail(input.email), deps.emailHashKey);
	const state = readLoginAttempt(deps.db, hash);
	if (state?.lockedUntil !== null && state?.lockedUntil !== undefined && state.lockedUntil > now) {
		deps.logger.emit('accounts.login.locked', {
			reason: 'too_many_failures',
			count: state.failures
		});
		throw new AppError('LOGIN_TEMPORARILY_LOCKED', {
			retryAfterMinutes: minutesLeft(state.lockedUntil, now)
		});
	}

	try {
		await deps.auth.api.signInEmail({
			body: { email: input.email, password: input.password },
			headers: headersFor(input.remoteIp)
		});
	} catch (error) {
		if (isNotVerified(error)) {
			deps.logger.emit('accounts.login.failed', {
				reason: 'not_verified',
				errorCode: 'EMAIL_NOT_VERIFIED'
			});
			throw new AppError('EMAIL_NOT_VERIFIED');
		}
		if (isBanned(error)) {
			deps.logger.emit('accounts.login.failed', {
				reason: 'blocked',
				errorCode: 'ACCOUNT_BLOCKED'
			});
			throw new AppError('ACCOUNT_BLOCKED');
		}
		if (!isBadCredentials(error)) throw error;
		const after = immediateTransaction(deps.db, (tx) =>
			recordLoginFailure(tx, hash, now, {
				maxFailures: numberSetting(deps, 'login_max_failures'),
				lockMinutes: numberSetting(deps, 'login_lock_minutes'),
				windowMinutes: LOGIN_WINDOW_MINUTES
			})
		);
		deps.logger.emit('accounts.login.failed', {
			reason: 'invalid_credentials',
			errorCode: 'INVALID_CREDENTIALS'
		});
		if (after.lockedUntil !== null && after.lockedUntil > now) {
			deps.logger.emit('accounts.login.locked', {
				reason: 'too_many_failures',
				count: after.failures
			});
			throw new AppError('LOGIN_TEMPORARILY_LOCKED', {
				retryAfterMinutes: minutesLeft(after.lockedUntil, now)
			});
		}
		throw new AppError('INVALID_CREDENTIALS');
	}

	immediateTransaction(deps.db, (tx) => {
		clearLoginAttempts(tx, hash);
	});
	deps.logger.emit('accounts.login.succeeded', { status: 'web' });
	return { redirectTo: safeRedirect(input.redirectTo) };
}

/** Solicitud de recuperación (W12): siempre neutra; el email solo sale si la cuenta existe. */
export async function requestPasswordReset(
	deps: AccountsDeps,
	input: { readonly email: string; readonly remoteIp: string | null }
): Promise<void> {
	const now = deps.clock.now();
	const ip = input.remoteIp;
	if (ip !== null) {
		immediateTransaction(deps.db, (tx) => {
			bumpRateCounter(tx, 'password_reset', ip, now, HOUR_MS);
		});
	}
	const email = input.email.toLowerCase();
	const exists = deps.db.select().from(user).where(eq(user.email, email)).get() !== undefined;
	if (exists) await deps.auth.api.requestPasswordReset({ body: { email } });
	deps.logger.emit('accounts.password.reset_requested', { status: exists ? 'sent' : 'suppressed' });
}

/** Nueva contraseña (W13): consume el token, pone a cero los intentos y envía el aviso de seguridad. */
export async function resetPassword(
	deps: AccountsDeps,
	input: { readonly token: string; readonly password: string }
): Promise<void> {
	const pending = deps.db
		.select({ userId: verification.value })
		.from(verification)
		.where(eq(verification.identifier, `reset-password:${input.token}`))
		.get();
	const target =
		pending === undefined
			? undefined
			: deps.db.select().from(user).where(eq(user.id, pending.userId)).get();
	try {
		await deps.auth.api.resetPassword({
			body: { newPassword: input.password, token: input.token }
		});
	} catch (error) {
		throw new AppError(isExpiredToken(error) ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
	}
	if (target !== undefined) {
		const hash = hashNormalizedEmail(normalizeEmail(target.email), deps.emailHashKey);
		immediateTransaction(deps.db, (tx) => {
			clearLoginAttempts(tx, hash);
		});
		await sendAccountEmail(deps.notifications, {
			reason: 'password_changed',
			to: target.email,
			idempotencyKey: randomUUID()
		});
	}
	deps.logger.emit('accounts.password.reset_completed', {});
}

/** Cierra la sesión de las cabeceras dadas (W15, BE-FR-06). */
export async function logout(deps: AccountsDeps, headers: Headers): Promise<void> {
	await deps.auth.api.signOut({ headers });
	deps.logger.emit('accounts.session.revoked', { reason: 'logout' });
}

/**
 * Estado de un token de verificación o recuperación, sin consumirlo (W09, W13). Un token inválido o de otra cuenta es
 * «invalid»; uno de una cuenta ya verificada, «used». La caducidad la decide Better Auth al usarlo.
 */
export function tokenStateOf(deps: AccountsBase, token: string): 'valid' | 'used' | 'invalid' {
	const email = emailOfToken(token);
	if (email === undefined) return 'invalid';
	const row = deps.db
		.select({ emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.email, email))
		.get();
	if (row === undefined) return 'invalid';
	return row.emailVerified ? 'used' : 'valid';
}

/** Sesión de las cabeceras dadas, o `null` si no hay una válida. */
export function readSession(deps: AccountsDeps, headers: Headers) {
	return deps.auth.api.getSession({ headers });
}

// ---------------------------------------------------------------------------------------------------------------------
// Administrador por ADMIN_EMAIL y dominios desechables

/** Tras verificar, la cuenta con `ADMIN_EMAIL` pasa a administrador si no hay otro (FR-017). Idempotente. */
export function promoteAdminIfEligible(deps: AccountsBase, userId: string, email: string): void {
	if (deps.adminEmail === null || normalizeEmail(email) !== normalizeEmail(deps.adminEmail)) return;
	immediateTransaction(deps.db, (tx: Tx) => {
		const current = tx.select({ role: user.role }).from(user).where(eq(user.id, userId)).get();
		if (current === undefined || current.role.split(',').includes('admin')) return;
		if (hasAnotherAdmin(tx, userId)) {
			deps.logger.emit('accounts.admin.promotion_refused', { reason: 'admin_exists' });
			return;
		}
		tx.update(user)
			.set({ role: `${current.role},admin` })
			.where(eq(user.id, userId))
			.run();
		deps.logger.emit('accounts.admin.promoted', {});
	});
}

/** ¿Hay otro administrador? Los roles son listas separadas por comas (data-model 2.8). */
function hasAnotherAdmin(tx: Tx, exceptId: string): boolean {
	return tx
		.select({ id: user.id, role: user.role })
		.from(user)
		.all()
		.some((row) => row.id !== exceptId && row.role.split(',').includes('admin'));
}

/** Siembra la lista inicial de dominios desechables (BE-FR-11 CA2). Idempotente. */
export function seedDisposableDomains(tx: Tx, now: EpochMs): void {
	insertDisposableDomains(tx, DISPOSABLE_DOMAINS_V1, now);
}

/** Instante de la composición en milisegundos, como `EpochMs`. */
export function instantOf(ms: number): EpochMs {
	return toEpochMs(ms);
}
