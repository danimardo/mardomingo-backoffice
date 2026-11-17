// Casos de uso de la cuenta (BE-FR-01 a BE-FR-06, BE-FR-11, BE-FR-67; contracts/web-routes.md W08–W15). Orquesta el
// antiabuso, Better Auth (`auth.api`), las aceptaciones legales y los emails. Las respuestas de registro, reenvío y
// recuperación son siempre neutras (no revelan si el email existe). Los errores de negocio son `AppError` con el código
// del catálogo; los errores de Better Auth se traducen en un único sitio (`betterAuthCode`).
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { CaptchaVerifier } from '$lib/server/adapters/turnstile/captcha-verifier';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { findActiveAppBySlug, getSetting, type AppsDeps } from '$lib/server/features/apps';
import {
	currentVersions,
	pendingAcceptancesOf,
	recordAcceptances,
	type LegalDeps,
	type PendingAcceptance
} from '$lib/server/features/legal';
import { sendAccountEmail, type NotificationsDeps } from '$lib/server/features/notifications';
import type { Logger } from '$lib/server/logging/logger';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { Auth } from './auth';
import { DISPOSABLE_DOMAINS_V1 } from './disposable-domains';
import { normalizeEmail } from './domain/email';
import { revokedSince, sessionIdsOf } from './close-session';
import { safeRedirect } from './domain/redirect';
import { hashNormalizedEmail } from './email-hash';
import {
	lockReachedBy,
	loginAttemptKeyOf,
	refundPasswordAttempt,
	reservePasswordAttempt,
	type PasswordAttempt
} from './password-attempts';
import {
	bumpRateCounter,
	type AuthRateScope,
	clearLoginAttempts,
	deleteSessionByToken,
	insertDisposableDomains,
	isDisposableDomain,
	loginCredentialOf,
	type LoginCredential,
	releaseSignupSlot,
	reserveSignupSlot,
	revocationMarksOf,
	sessionOwnerOf,
	setSignupMetadata
} from './repository';
import type { EmailDispatcher } from './email-dispatch';
import { deletePendingEmailChanges, deleteResetTokens } from './pending-tokens';
import { session, user, userAppActivity, verification } from './schema';

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
	/** Envío de los emails de cuenta sin esperarlos (C-17). */
	readonly emails: EmailDispatcher;
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
/** Una reserva de alta en curso deja de contar a los 10 minutos de la última (C-21): un alta dura segundos. */
const SIGNUP_PENDING_TTL_MS = 10 * 60 * 1000;

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
	| 'registrations_per_ip_24h'
	| 'login_max_failures'
	| 'login_lock_minutes'
	| 'login_per_ip_15min'
	| 'resend_verification_per_ip_hour'
	| 'password_reset_per_ip_hour'
	| 'min_age';

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

// ---------------------------------------------------------------------------------------------------------------------
// Alta y verificación (W08–W10)

/**
 * Iguala el tiempo del registro de un email ya existente con el de uno nuevo (que termina en `sendVerificationEmail`, con el
 * suelo de tiempo constante de Better Auth): la misma llamada sobre una dirección que no puede existir (`.invalid`, RFC 2606)
 * firma un token y espera el suelo, sin enviar nada (C-17).
 */
async function matchVerificationTiming(deps: AccountsDeps): Promise<void> {
	await deps.auth.api.sendVerificationEmail({ body: { email: 'registro@mardomingo.invalid' } });
}

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

	// Reserva atómica del hueco antes de crear la cuenta (C-21). Sin IP conocida no hay límite (como hasta ahora).
	const ip = input.remoteIp;
	if (ip !== null) {
		const limit = numberSetting(deps, 'registrations_per_ip_24h');
		const reserved = immediateTransaction(deps.db, (tx) =>
			reserveSignupSlot(tx, ip, now, { limit, pendingTtlMs: SIGNUP_PENDING_TTL_MS })
		);
		if (!reserved) return reject('ip_limit', 'REGISTRATION_IP_LIMIT');
	}
	// Si el alta se crea, el hueco se suelta en la transacción que escribe `signup_ip` y pasa a contar como alta creada. Si no
	// se crea por cualquier motivo (versiones legales, email ya registrado, error), se suelta aquí: hoy solo cuentan las
	// cuentas creadas, y un intento que no crea nada no debe gastar hueco.
	const slot = { held: ip !== null };
	try {
		return await createAccount(deps, input, now, reject, slot);
	} finally {
		if (ip !== null && slot.held) {
			immediateTransaction(deps.db, (tx) => {
				releaseSignupSlot(tx, ip);
			});
		}
	}
}

/**
 * Versiones legales → alta en Better Auth → metadatos y aceptaciones. `slot.held` pasa a `false` cuando la transacción que
 * escribe `signup_ip` ya ha soltado el hueco reservado.
 */
async function createAccount(
	deps: AccountsDeps,
	input: RegisterInput,
	now: EpochMs,
	reject: (reason: 'legal_version_changed', code: ErrorCode) => never,
	slot: { held: boolean }
): Promise<{ readonly sentTo: string }> {
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
			await matchVerificationTiming(deps);
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
		await matchVerificationTiming(deps);
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
		// El hueco en curso pasa a ser un alta creada en la misma transacción (C-21).
		if (input.remoteIp !== null) releaseSignupSlot(tx, input.remoteIp);
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
	slot.held = false;

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
		ipRateLimited(
			deps,
			'resend_verification',
			ip,
			now,
			HOUR_MS,
			numberSetting(deps, 'resend_verification_per_ip_hour')
		);
	}
	const email = input.email.toLowerCase();
	const row = deps.db.select().from(user).where(eq(user.email, email)).get();
	const pending = row !== undefined && !row.emailVerified;
	// Better Auth aplica a este endpoint un suelo de tiempo constante (500 ms) tanto si la cuenta existe como si no, y solo
	// envía el email si está pendiente: se llama siempre para que el tiempo no distinga ambos casos (C-17).
	await deps.auth.api.sendVerificationEmail({ body: { email } });
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

/**
 * Autenticación común de la web y de las apps (BE-FR-03, BE-FR-67): bloqueo por intentos por email normalizado, exista o
 * no la cuenta (CA1); luego credenciales, cuenta bloqueada y cuenta sin verificar. Devuelve el token de la sesión nueva.
 */
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Límite por IP de una acción (BE-FR-45, D-02): cuenta la petición en su ventana fija y, si supera el máximo, la rechaza
 * con `RATE_LIMITED` y `Retry-After`. El evento no lleva la IP.
 */
export function ipRateLimited(
	deps: AccountsDeps,
	scope: AuthRateScope,
	ip: string,
	now: EpochMs,
	windowMs: number,
	limit: number
): void {
	const counter = immediateTransaction(deps.db, (tx) =>
		bumpRateCounter(tx, scope, ip, now, windowMs)
	);
	if (counter.count <= limit) return;
	deps.logger.emit('accounts.rate_limit.exceeded', { reason: scope });
	const remainingMs = counter.windowStart + windowMs - now;
	throw new AppError('RATE_LIMITED', {
		retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000))
	});
}

/**
 * Rechaza el login como credenciales inválidas. El intento reservado queda contado como fallo; si alcanza el umbral, la
 * respuesta es el bloqueo (BE-FR-67).
 */
function rejectAsInvalidCredentials(
	deps: AccountsDeps,
	attempt: Extract<PasswordAttempt, { kind: 'reserved' }>
): never {
	deps.logger.emit('accounts.login.failed', {
		reason: 'invalid_credentials',
		errorCode: 'INVALID_CREDENTIALS'
	});
	const lockMinutes = lockReachedBy(attempt);
	if (lockMinutes !== null) {
		deps.logger.emit('accounts.login.locked', {
			reason: 'too_many_failures',
			count: attempt.state.failures
		});
		throw new AppError('LOGIN_TEMPORARILY_LOCKED', { retryAfterMinutes: lockMinutes });
	}
	throw new AppError('INVALID_CREDENTIALS');
}

/**
 * ¿Sigue la cuenta como estaba cuando Better Auth comprobó la contraseña (C-27)? Misma cuenta, mismo email, sin borrar y con
 * la misma credencial (un cambio o una recuperación de contraseña cambian el hash, que lleva su propia sal).
 */
function credentialUnchanged(
	before: LoginCredential | undefined,
	after: LoginCredential | undefined
): boolean {
	return (
		before !== undefined &&
		after !== undefined &&
		before.passwordHash !== null &&
		after.passwordHash === before.passwordHash &&
		after.userId === before.userId &&
		after.email === before.email &&
		after.deletedAt === null
	);
}

async function authenticate(deps: AccountsDeps, input: LoginInput): Promise<string> {
	const now = deps.clock.now();
	if (input.remoteIp !== null) {
		ipRateLimited(
			deps,
			'login',
			input.remoteIp,
			now,
			LOGIN_IP_WINDOW_MS,
			numberSetting(deps, 'login_per_ip_15min')
		);
	}
	// Reserva atómica antes de comprobar la contraseña (C-16): el mismo camino y las mismas escrituras exista o no la cuenta.
	const attempt = reservePasswordAttempt(deps, loginAttemptKeyOf(deps, input.email));
	if (attempt.kind === 'locked') {
		deps.logger.emit('accounts.login.locked', {
			reason: 'too_many_failures',
			count: attempt.failures
		});
		throw new AppError('LOGIN_TEMPORARILY_LOCKED', {
			retryAfterMinutes: attempt.retryAfterMinutes
		});
	}

	// Instantánea de la credencial antes de que Better Auth la lea (C-27): la busca igual que él, por el email en minúsculas.
	const before = loginCredentialOf(deps.db, { email: input.email.toLowerCase() });
	let token: string;
	try {
		({ token } = await deps.auth.api.signInEmail({
			body: { email: input.email, password: input.password },
			headers: headersFor(input.remoteIp)
		}));
	} catch (error) {
		// Better Auth solo responde «sin verificar» o «bloqueada» tras comprobar la contraseña: no fue un fallo.
		if (isNotVerified(error)) {
			refundPasswordAttempt(deps, attempt);
			deps.logger.emit('accounts.login.failed', {
				reason: 'not_verified',
				errorCode: 'EMAIL_NOT_VERIFIED'
			});
			throw new AppError('EMAIL_NOT_VERIFIED');
		}
		if (isBanned(error)) {
			refundPasswordAttempt(deps, attempt);
			deps.logger.emit('accounts.login.failed', {
				reason: 'blocked',
				errorCode: 'ACCOUNT_BLOCKED'
			});
			throw new AppError('ACCOUNT_BLOCKED');
		}
		// Un error inesperado deja el intento contado (falla cerrado; ver `password-attempts.ts`).
		if (!isBadCredentials(error)) throw error;
		return rejectAsInvalidCredentials(deps, attempt);
	}

	// Better Auth crea la sesión sin volver a leer la credencial que comprobó antes de esperar al hash (C-27). Si entretanto se
	// borró la cuenta, se cambió o recuperó la contraseña o se cambió el email, esas operaciones ya cerraron las sesiones que
	// había y esta se crearía después: se vuelve a leer la credencial en una transacción IMMEDIATE, serializada con ellas. Si
	// cambió (o la sesión ya no existe), se borra la sesión nueva y el login falla como una contraseña errónea: la contraseña
	// ya no es la de la cuenta (o la cuenta ya no existe, y el intento cuenta exista o no, BE-FR-67 CA1). Una revocación que
	// llegue después de esta transacción ya encuentra la sesión y la borra.
	const intact = immediateTransaction(deps.db, (tx) => {
		const ownerId = sessionOwnerOf(tx, token);
		const after = ownerId === undefined ? undefined : loginCredentialOf(tx, { userId: ownerId });
		if (!credentialUnchanged(before, after)) {
			deleteSessionByToken(tx, token);
			return false;
		}
		clearLoginAttempts(tx, attempt.key);
		return true;
	});
	if (!intact) return rejectAsInvalidCredentials(deps, attempt);
	return token;
}

/** Login web (W11): la misma política que `authenticate`, y la página a la que volver, ya saneada. */
export async function login(
	deps: AccountsDeps,
	input: LoginInput
): Promise<{ readonly redirectTo: string }> {
	await authenticate(deps, input);
	deps.logger.emit('accounts.login.succeeded', { status: 'web' });
	return { redirectTo: safeRedirect(input.redirectTo) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Login de app y sesión por app (BE-FR-03 CA2–CA3, BE-FR-65 CA3, D-13; T132–T133)

const MINUTE_MS = 60 * 1000;

export interface AppLoginInput {
	readonly email: string;
	readonly password: string;
	readonly remoteIp: string | null;
	readonly appId: string;
	readonly deviceName: string | null;
	readonly appVersion: string | null;
}

export interface AppLoginResult {
	readonly token: string;
	readonly expiresAt: string;
	readonly user: { readonly email: string; readonly roles: readonly string[] };
	readonly pendingAcceptances: readonly PendingAcceptance[];
}

/**
 * Login de una app: la misma política que la web, y la sesión queda ligada a la app, al equipo y a la versión. Lo que
 * Better Auth no rellena en la sesión (`app_id`, `device_name`, `app_version`) se escribe aquí, en la misma petición, en
 * vez de con un `databaseHooks` (que no recibe la app). Se registra la actividad de la cuenta en la app (`user_app_activity`).
 */
export async function loginFromApp(
	deps: AccountsDeps,
	input: AppLoginInput
): Promise<AppLoginResult> {
	const token = await authenticate(deps, {
		email: input.email,
		password: input.password,
		redirectTo: undefined,
		remoteIp: input.remoteIp
	});
	const now = deps.clock.now();
	const created = deps.db
		.select({ id: session.id, userId: session.userId, expiresAt: session.expiresAt })
		.from(session)
		.where(eq(session.token, token))
		.get();
	if (created === undefined) throw new AppError('INTERNAL_ERROR', { reason: 'session_missing' });
	const account = deps.db
		.select({ email: user.email, role: user.role })
		.from(user)
		.where(eq(user.id, created.userId))
		.get();
	if (account === undefined) throw new AppError('INTERNAL_ERROR', { reason: 'user_missing' });

	immediateTransaction(deps.db, (tx) => {
		tx.update(session)
			.set({
				appId: input.appId,
				deviceName: input.deviceName,
				appVersion: input.appVersion,
				lastUsedAt: now
			})
			.where(eq(session.id, created.id))
			.run();
		const activity = tx
			.select({ lastUsedAt: userAppActivity.lastUsedAt })
			.from(userAppActivity)
			.where(
				and(eq(userAppActivity.userId, created.userId), eq(userAppActivity.appId, input.appId))
			)
			.get();
		if (activity === undefined) {
			tx.insert(userAppActivity)
				.values({ userId: created.userId, appId: input.appId, firstLoginAt: now, lastUsedAt: now })
				.run();
		} else {
			tx.update(userAppActivity)
				.set({ lastUsedAt: now })
				.where(
					and(eq(userAppActivity.userId, created.userId), eq(userAppActivity.appId, input.appId))
				)
				.run();
		}
	});
	deps.logger.emit('accounts.login.succeeded', { status: 'app' });
	return {
		token,
		expiresAt: created.expiresAt.toISOString(),
		user: { email: account.email, roles: account.role.split(',') },
		pendingAcceptances: pendingAcceptancesOf(deps.db, created.userId, now)
	};
}

/**
 * Renueva `last_used_at` de la sesión y de la actividad de la app como mucho una vez por minuto (T132). Así una app que
 * llama mucho no escribe en cada petición.
 */
export function touchAppSession(
	deps: AccountsDeps,
	input: { readonly sessionId: string; readonly userId: string; readonly appId: string }
): void {
	const now = deps.clock.now();
	const cutoff = now - MINUTE_MS;
	immediateTransaction(deps.db, (tx) => {
		const current = tx
			.select({ lastUsedAt: session.lastUsedAt })
			.from(session)
			.where(eq(session.id, input.sessionId))
			.get();
		if (current !== undefined && (current.lastUsedAt === null || current.lastUsedAt < cutoff)) {
			tx.update(session).set({ lastUsedAt: now }).where(eq(session.id, input.sessionId)).run();
		}
		const activity = tx
			.select({ lastUsedAt: userAppActivity.lastUsedAt })
			.from(userAppActivity)
			.where(and(eq(userAppActivity.userId, input.userId), eq(userAppActivity.appId, input.appId)))
			.get();
		if (activity !== undefined && activity.lastUsedAt < cutoff) {
			tx.update(userAppActivity)
				.set({ lastUsedAt: now })
				.where(
					and(eq(userAppActivity.userId, input.userId), eq(userAppActivity.appId, input.appId))
				)
				.run();
		}
	});
}

/** Solicitud de recuperación (W12): siempre neutra; el email solo sale si la cuenta existe. */
export async function requestPasswordReset(
	deps: AccountsDeps,
	input: { readonly email: string; readonly remoteIp: string | null }
): Promise<void> {
	const now = deps.clock.now();
	const ip = input.remoteIp;
	if (ip !== null) {
		ipRateLimited(
			deps,
			'password_reset',
			ip,
			now,
			HOUR_MS,
			numberSetting(deps, 'password_reset_per_ip_hour')
		);
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
	const sessionsBefore = target === undefined ? [] : sessionIdsOf(deps.db, target.id);
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
			// Una recuperación anula las demás y los cambios de email pedidos antes (C-15, C-20).
			deleteResetTokens(tx, target.id);
			deletePendingEmailChanges(tx, target.id);
		});
		await sendAccountEmail(deps.notifications, {
			reason: 'password_changed',
			to: target.email,
			idempotencyKey: randomUUID()
		});
	}
	deps.logger.emit('accounts.password.reset_completed', {});
	if (target !== undefined) {
		deps.logger.emit('accounts.session.revoked', {
			reason: 'password_changed',
			count: revokedSince(deps.db, target.id, sessionsBefore)
		});
	}
}

/** Cierra la sesión de las cabeceras dadas (W15, BE-FR-06). */
export async function logout(deps: AccountsDeps, headers: Headers): Promise<void> {
	const current = await deps.auth.api.getSession({ headers });
	await deps.auth.api.signOut({ headers });
	deps.logger.emit('accounts.session.revoked', {
		reason: 'logout',
		count: current === null ? 0 : 1
	});
}

/**
 * Estado de un token de verificación, sin consumirlo (W09). Un token inválido o de otra cuenta es
 * «invalid»; uno de una cuenta ya verificada, «used». La caducidad la decide Better Auth al usarlo.
 */
export function verificationTokenStateOf(
	deps: AccountsBase,
	token: string
): 'valid' | 'used' | 'invalid' {
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

/**
 * Estado de un token de recuperación, sin consumirlo (W13). Better Auth lo guarda opaco en `verification` con el
 * identificador `reset-password:<token>` y lo borra al usarlo, así que «válido» es que la fila exista y no haya caducado.
 * No hay estado «used»: un token usado ya no existe, y la página lo muestra como no válido.
 */
export function resetTokenStateOf(deps: AccountsBase, token: string): 'valid' | 'invalid' {
	const row = deps.db
		.select({ expiresAt: verification.expiresAt })
		.from(verification)
		.where(eq(verification.identifier, `reset-password:${token}`))
		.get();
	if (row === undefined || row.expiresAt.getTime() <= deps.clock.now()) return 'invalid';
	return 'valid';
}

/**
 * Sesión de las cabeceras dadas, o `null` si no hay una válida. La de una cuenta borrada o bloqueada no vale aunque siga en
 * la base de datos (C-27, defensa en profundidad): el borrado y el bloqueo cierran las sesiones, pero Better Auth no mira
 * `deleted_at` y su plugin `admin` solo mira `banned` al crear la sesión, no al leerla.
 */
export async function readSession(deps: AccountsDeps, headers: Headers) {
	const current = await deps.auth.api.getSession({ headers });
	if (current === null) return null;
	const marks = revocationMarksOf(deps.db, current.user.id);
	if (marks === undefined || marks.deleted || marks.banned) return null;
	return current;
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

/**
 * Bloquea una cuenta y cierra todas sus sesiones (BE-FR-28: contracargo). Con la cuenta bloqueada, `guardAccess` deniega el
 * acceso. Idempotente: bloquear otra vez deja el mismo estado.
 */
export function blockAccount(
	deps: { readonly db: Db; readonly logger: Logger },
	input: { readonly userId: string; readonly reason: 'chargeback' }
): void {
	const closed = immediateTransaction(deps.db, (tx) => {
		tx.update(user)
			.set({ banned: true, banReason: input.reason })
			.where(eq(user.id, input.userId))
			.run();
		return tx.delete(session).where(eq(session.userId, input.userId)).run().changes;
	});
	deps.logger.emit('accounts.user.blocked', { reason: input.reason });
	deps.logger.emit('accounts.session.revoked', { reason: 'blocked', count: closed });
}
