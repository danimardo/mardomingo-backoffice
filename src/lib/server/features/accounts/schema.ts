// Tablas de la funcionalidad `accounts` (data-model.md 2.8): las bases de Better Auth con sus campos propios y
// las tablas propias de autenticación y actividad. Las claves externas hacia `apps` (funcionalidad anterior) son
// `references()`; las que apuntan a funcionalidades posteriores se declaran solo en `schema.ts` (D-03).
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
	bool,
	boolCheck,
	enumCheck,
	epochMs,
	nonNegativeCheck,
	nowMs as now
} from '$lib/server/db/columns';
import { apps } from '../apps/schema';

export const AUTH_RATE_SCOPES = Object.freeze([
	'login',
	'signup',
	'resend_verification',
	'password_reset',
	'email_change'
] as const);

export const user = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull().default(''),
		email: text('email').notNull().unique(),
		emailVerified: bool('email_verified').notNull().default(false),
		image: text('image'),
		role: text('role').notNull().default('user'),
		banned: bool('banned').notNull().default(false),
		banReason: text('ban_reason'),
		banExpires: epochMs('ban_expires'),
		emailNormalized: text('email_normalized'),
		signupAppId: text('signup_app_id').references(() => apps.id, { onDelete: 'restrict' }),
		signupIp: text('signup_ip'),
		lastActivityAt: epochMs('last_activity_at'),
		inactivityWarnedAt: epochMs('inactivity_warned_at'),
		deletedAt: epochMs('deleted_at'),
		createdAt: epochMs('created_at').notNull().default(now),
		updatedAt: epochMs('updated_at').notNull().default(now)
	},
	(table) => [
		check('user_role_not_empty', sql`${sql.identifier('role')} <> ''`),
		check(
			'user_deleted_has_no_email_normalized',
			sql`${sql.identifier('deleted_at')} IS NULL OR ${sql.identifier('email_normalized')} IS NULL`
		),
		check('user_email_verified_bool', boolCheck(table.emailVerified.name)),
		check('user_banned_bool', boolCheck(table.banned.name)),
		// No único (D-11): varias cuentas pueden compartir la forma normalizada; la bienvenida única es de `welcome_grants`.
		index('user_email_normalized_idx').on(table.emailNormalized),
		index('user_signup_ip_created_idx').on(table.signupIp, table.createdAt),
		index('user_unverified_purge_idx').on(table.emailVerified, table.createdAt),
		index('user_signup_app_created_idx').on(table.signupAppId, table.createdAt),
		index('user_inactivity_idx')
			.on(table.lastActivityAt)
			.where(
				sql`${sql.identifier('deleted_at')} IS NULL AND ${sql.identifier('email_verified')} = 1`
			),
		// Un solo administrador (FR-017): índice único sobre una expresión constante, restringido por rol.
		uniqueIndex('one_admin')
			.on(sql`(1)`)
			.where(
				sql`',' || ${sql.identifier('role')} || ',' LIKE '%,admin,%' AND ${sql.identifier('deleted_at')} IS NULL`
			)
	]
);

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: epochMs('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		impersonatedBy: text('impersonated_by'),
		appId: text('app_id').references(() => apps.id, { onDelete: 'restrict' }),
		deviceName: text('device_name'),
		appVersion: text('app_version'),
		lastUsedAt: epochMs('last_used_at'),
		createdAt: epochMs('created_at').notNull().default(now),
		updatedAt: epochMs('updated_at').notNull().default(now)
	},
	(table) => [
		index('session_user_idx').on(table.userId),
		index('session_expires_idx').on(table.expiresAt)
	]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		password: text('password'),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: epochMs('access_token_expires_at'),
		refreshTokenExpiresAt: epochMs('refresh_token_expires_at'),
		scope: text('scope'),
		createdAt: epochMs('created_at').notNull().default(now),
		updatedAt: epochMs('updated_at').notNull().default(now)
	},
	(table) => [
		uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
		index('account_user_idx').on(table.userId)
	]
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: epochMs('expires_at').notNull(),
		createdAt: epochMs('created_at').notNull().default(now),
		updatedAt: epochMs('updated_at').notNull().default(now)
	},
	(table) => [
		index('verification_identifier_idx').on(table.identifier),
		index('verification_expires_idx').on(table.expiresAt)
	]
);

// Contadores de los límites de autenticación por IP (BE-FR-45, D-02). Sustituyen a la tabla `rate_limit` de Better Auth.
export const authRateLimits = sqliteTable(
	'auth_rate_limits',
	{
		scope: text('scope', { enum: AUTH_RATE_SCOPES }).notNull(),
		ip: text('ip').notNull(),
		count: integer('count').notNull().default(0),
		windowStart: epochMs('window_start').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.scope, table.ip] }),
		check('auth_rate_limits_scope_enum', enumCheck(table.scope.name, AUTH_RATE_SCOPES)),
		check('auth_rate_limits_count_non_negative', nonNegativeCheck(table.count.name)),
		index('auth_rate_limits_window_idx').on(table.windowStart)
	]
);

// Intentos fallidos de inicio de sesión (BE-FR-67). La clave es el HMAC del email normalizado (D-11).
export const loginAttempts = sqliteTable(
	'login_attempts',
	{
		emailNormalizedHash: text('email_normalized_hash').primaryKey(),
		failures: integer('failures').notNull().default(0),
		windowStart: epochMs('window_start').notNull(),
		lockedUntil: epochMs('locked_until')
	},
	(table) => [
		check('login_attempts_failures_non_negative', nonNegativeCheck(table.failures.name)),
		index('login_attempts_window_idx').on(table.windowStart)
	]
);

// Dominios de email desechables (BE-FR-11.2), refrescados semanalmente.
export const disposableDomains = sqliteTable('disposable_domains', {
	domain: text('domain').primaryKey(),
	updatedAt: epochMs('updated_at').notNull().default(now)
});

// Primer login y último uso de cada cuenta por app (D-13; BE-FR-54, BE-FR-85, BE-FR-86).
export const userAppActivity = sqliteTable(
	'user_app_activity',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'restrict' }),
		firstLoginAt: epochMs('first_login_at').notNull(),
		lastUsedAt: epochMs('last_used_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.appId] }),
		index('user_app_activity_app_idx').on(table.appId, table.firstLoginAt)
	]
);
