// Esquema de la configuración del proceso (constitución, «Configuración y variables de entorno»).
// Sin imports de SvelteKit: lo reutilizan los scripts de Node (drizzle.config.ts, seeds, mantenimiento)
// y los tests, que pasan el entorno por parámetro. Solo `env.ts` lee el entorno real.
import { z } from 'zod';

export const APP_ENVS = Object.freeze(['development', 'test', 'staging', 'production'] as const);
export type AppEnv = (typeof APP_ENVS)[number];

const LOG_LEVELS = Object.freeze([
	'trace',
	'debug',
	'info',
	'warn',
	'error',
	'fatal',
	'silent'
] as const);

// Hosts que nunca pueden aparecer en las URL públicas de staging o producción.
const LOCAL_HOSTS: readonly string[] = Object.freeze(['localhost', '127.0.0.1']);

// Claves de prueba oficiales de Turnstile: siempre aceptan o rechazan, nunca protegen nada.
const TURNSTILE_TEST_KEY = /^[123]x0+[A-Z]{2}$/;

// Variables que solo existen para las pruebas: rechazadas fuera de APP_ENV=test.
const TEST_ONLY_KEYS = Object.freeze([
	'MOCK_OPENROUTER_URL',
	'MOCK_MISTRAL_URL',
	'MOCK_RESEND_URL',
	'MOCK_BCE_URL',
	'MOCK_TURNSTILE_URL',
	'MOCK_GITHUB_URL',
	'EMAIL_OUTBOX_DIR',
	'CAPTCHA_FAKE'
] as const);

// Requeridas solo en staging y producción (en test y desarrollo pueden estar vacías).
const DEPLOYED_REQUIRED_KEYS = Object.freeze([
	'OPENROUTER_API_KEY',
	'MISTRAL_API_KEY',
	'RESEND_API_KEY',
	'PUBLIC_TURNSTILE_SITE_KEY',
	'TURNSTILE_SECRET'
] as const);

// Entero leído de texto (los valores del entorno siempre llegan como cadena).
const intFromEnv = (min: number, max: number) =>
	z
		.string()
		.regex(/^\d+$/)
		.transform((text) => Number(text))
		.pipe(z.int().min(min).max(max));

const booleanFromEnv = z.enum(['true', 'false']).transform((text) => text === 'true');

const logLevel = z.enum(LOG_LEVELS);

const baseSchema = z.object({
	APP_ENV: z.enum(APP_ENVS).default('development'),
	PUBLIC_API_URL: z.url(),
	PUBLIC_WEB_URL: z.url(),
	PUBLIC_TURNSTILE_SITE_KEY: z.string().default(''),
	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string().min(32),
	DATABASE_PATH: z.string().min(1),
	EMAIL_HASH_KEY: z.string().min(32),
	EMAIL_FROM: z.string().min(1).default('Cuenta Mardomingo <no-reply@mardomingo.com>'),
	ADMIN_EMAIL: z.email().optional(),
	OPENROUTER_API_KEY: z.string().default(''),
	OPENROUTER_MANAGEMENT_KEY: z.string().optional(),
	MISTRAL_API_KEY: z.string().default(''),
	RESEND_API_KEY: z.string().default(''),
	TURNSTILE_SECRET: z.string().default(''),
	PAYMENTS_PROVIDER: z.enum(['simulated', 'stripe']).default('simulated'),
	INVOICING_PROVIDER: z.enum(['none', 'fake', 'stripe', 'verifactu']).default('none'),
	LOG_LEVEL: logLevel.optional(),
	CLIENT_LOG_LEVEL: logLevel.optional(),
	PORT: intFromEnv(1, 65535).default(3000),
	HOST: z.string().default('0.0.0.0'),
	ADDRESS_HEADER: z.string().default('x-forwarded-for'),
	XFF_DEPTH: intFromEnv(0, 10).default(1),
	PROTOCOL_HEADER: z.string().default('x-forwarded-proto'),
	/** Sin valor, SvelteKit usa 512K: la comprobación de arranque lo tiene en cuenta (FR-070). */
	BODY_SIZE_LIMIT: z.string().optional(),
	MOCK_OPENROUTER_URL: z.url().optional(),
	MOCK_MISTRAL_URL: z.url().optional(),
	MOCK_RESEND_URL: z.url().optional(),
	MOCK_BCE_URL: z.url().optional(),
	MOCK_TURNSTILE_URL: z.url().optional(),
	MOCK_GITHUB_URL: z.url().optional(),
	EMAIL_OUTBOX_DIR: z.string().min(1).optional(),
	CAPTCHA_FAKE: booleanFromEnv.optional()
});

const envSchema = baseSchema
	.superRefine((env, ctx) => {
		const deployed = env.APP_ENV === 'staging' || env.APP_ENV === 'production';

		for (const key of TEST_ONLY_KEYS) {
			if (env.APP_ENV !== 'test' && env[key] !== undefined) {
				ctx.addIssue({
					code: 'custom',
					path: [key],
					message: 'Esta opción solo es válida con APP_ENV=test.'
				});
			}
		}

		if (env.PAYMENTS_PROVIDER === 'stripe') {
			ctx.addIssue({
				code: 'custom',
				path: ['PAYMENTS_PROVIDER'],
				message: 'Stripe no está disponible en la v4: usa simulated.'
			});
		}

		// `fake` es el doble de pruebas: solo con APP_ENV=test. En la v4 la facturación real es `none` (BE-FR-75).
		const fakeAllowed = env.INVOICING_PROVIDER === 'fake' && env.APP_ENV === 'test';
		if (env.INVOICING_PROVIDER !== 'none' && !fakeAllowed) {
			ctx.addIssue({
				code: 'custom',
				path: ['INVOICING_PROVIDER'],
				message: 'En la v4 la facturación es none (BE-FR-75).'
			});
		}

		if (!deployed) return;

		for (const key of ['PUBLIC_API_URL', 'PUBLIC_WEB_URL', 'BETTER_AUTH_URL'] as const) {
			if (LOCAL_HOSTS.includes(new URL(env[key]).hostname)) {
				ctx.addIssue({
					code: 'custom',
					path: [key],
					message: 'No puede apuntar a localhost en staging ni en producción.'
				});
			}
		}

		for (const key of DEPLOYED_REQUIRED_KEYS) {
			if (env[key] === '') {
				ctx.addIssue({
					code: 'custom',
					path: [key],
					message: 'Obligatoria en staging y producción.'
				});
			}
		}

		if (env.APP_ENV === 'production') {
			if (TURNSTILE_TEST_KEY.test(env.PUBLIC_TURNSTILE_SITE_KEY)) {
				ctx.addIssue({
					code: 'custom',
					path: ['PUBLIC_TURNSTILE_SITE_KEY'],
					message: 'La clave de prueba de Turnstile no se admite en producción.'
				});
			}
			if (TURNSTILE_TEST_KEY.test(env.TURNSTILE_SECRET)) {
				ctx.addIssue({
					code: 'custom',
					path: ['TURNSTILE_SECRET'],
					message: 'El secreto de prueba de Turnstile no se admite en producción.'
				});
			}
		}
	})
	.transform((env) => ({
		...env,
		// Valores por defecto según el entorno (constitución, «Variables» y Historias 4.3).
		LOG_LEVEL: env.LOG_LEVEL ?? (env.APP_ENV === 'production' ? 'info' : 'debug'),
		CAPTCHA_FAKE: env.CAPTCHA_FAKE ?? false,
		CLIENT_LOG_LEVEL: env.CLIENT_LOG_LEVEL ?? (env.APP_ENV === 'production' ? 'warn' : 'debug')
	}));

export type Env = z.output<typeof envSchema>;

/**
 * Error de configuración. Enumera los NOMBRES de las variables que faltan o no son válidas.
 * Nunca incluye valores: ni los recibidos ni los secretos.
 */
export class EnvConfigError extends Error {
	readonly names: readonly string[];

	constructor(names: readonly string[]) {
		super(`Configuración del entorno inválida. Revisa estas variables: ${names.join(', ')}`);
		this.name = 'EnvConfigError';
		this.names = names;
	}
}

// Las cadenas vacías se tratan como ausentes: así un `.env` con `CLAVE=` usa el valor por defecto.
function withoutEmpty(
	source: Readonly<Record<string, string | undefined>>
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(source)) {
		if (value !== undefined && value.trim() !== '') out[key] = value.trim();
	}
	return out;
}

/** Valida el entorno recibido. Lanza `EnvConfigError` con los nombres de las variables afectadas. */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
	const result = envSchema.safeParse(withoutEmpty(source));
	if (!result.success) {
		const names = [
			...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'configuración')))
		];
		throw new EnvConfigError(names.sort());
	}
	return result.data;
}

const databasePathSchema = z.object({ DATABASE_PATH: z.string().min(1) });

/** Ruta de la BD para las herramientas de línea de órdenes (drizzle-kit), sin validar el resto del entorno. */
export function readDatabasePath(source: Readonly<Record<string, string | undefined>>): string {
	const result = databasePathSchema.safeParse(withoutEmpty(source));
	if (!result.success) throw new EnvConfigError(['DATABASE_PATH']);
	return result.data.DATABASE_PATH;
}
