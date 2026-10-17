// Better Auth 1.7.7 para la cuenta (R02; BE-FR-03, 04, 05, 09). Es una fábrica: se crea una vez desde la composición en
// `init` y nunca al nivel del módulo. Sin `svelteKitHandler`: `accounts` llama a `auth.api` desde las actions y desde
// la API, así que `/api/auth/*` no existe y los dos hosts siguen separados. Sin el plugin `captcha` ni `rateLimit`
// (no actúan con `auth.api`; el captcha y los límites por IP van en `accounts` con sus propios adaptadores y tablas).
import { betterAuth } from 'better-auth';
import { admin, bearer } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { account, session, user, verification } from './schema';

const DAY_SECONDS = 86_400;

export interface AuthDeps {
	readonly db: Db;
	readonly secret: string;
	/** `BETTER_AUTH_URL`: el origen público de la web (sin barra final). */
	readonly baseUrl: string;
	/** Envía el enlace de verificación (24 h). El enlace lo construye el servicio, con su propia ruta (R02). */
	readonly sendVerification: (email: string, userId: string, token: string) => Promise<void>;
	/** Envía el enlace de recuperación (1 h, un solo uso). */
	readonly sendPasswordReset: (email: string, userId: string, token: string) => Promise<void>;
	/** Tras verificar: promoción por `ADMIN_EMAIL` y demás efectos, en su transacción idempotente (R02). */
	readonly onEmailVerified: (userId: string, email: string) => void;
	/** Solo en la web: escribe la cookie de sesión desde las actions. Fuera de una petición se omite. */
	readonly requestEvent?: () => RequestEvent;
}

export function createAuth(deps: AuthDeps) {
	return betterAuth({
		secret: deps.secret,
		baseURL: deps.baseUrl,
		database: drizzleAdapter(deps.db, {
			provider: 'sqlite',
			schema: { user, session, account, verification },
			// better-sqlite3 es síncrono: sin transacciones asíncronas (R02, R03).
			transaction: false
		}),
		user: {
			additionalFields: {
				emailNormalized: { type: 'string', required: false, input: false }
			}
		},
		session: {
			// 30 días, deslizantes: se renuevan si han pasado más de 24 h desde la última renovación (BE-FR-04).
			expiresIn: 30 * DAY_SECONDS,
			updateAge: DAY_SECONDS,
			additionalFields: {
				appId: { type: 'string', required: false, input: false },
				deviceName: { type: 'string', required: false, input: false },
				appVersion: { type: 'string', required: false, input: false }
			}
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			autoSignIn: false,
			minPasswordLength: 8,
			maxPasswordLength: 128,
			resetPasswordTokenExpiresIn: 3600,
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: async ({ user: target, token }) => {
				await deps.sendPasswordReset(target.email, target.id, token);
			}
		},
		emailVerification: {
			sendOnSignUp: false,
			expiresIn: DAY_SECONDS,
			// W09: verificar el email inicia la sesión web (la verificación ocurre por POST desde el botón, no al abrir el enlace).
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user: target, token }) => {
				await deps.sendVerification(target.email, target.id, token);
			},
			afterEmailVerification: (target) => {
				deps.onEmailVerified(target.id, target.email);
				return Promise.resolve();
			}
		},
		plugins: [
			bearer(),
			admin(),
			...(deps.requestEvent === undefined ? [] : [sveltekitCookies(deps.requestEvent)])
		],
		rateLimit: { enabled: false },
		advanced: {
			// La IP la pone `accounts` desde `getClientAddress()` en una cabecera interna (y la borra si llega del cliente).
			ipAddress: { ipAddressHeaders: ['x-mm-client-ip'] }
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
