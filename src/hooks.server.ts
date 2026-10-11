// Hooks del servidor (constitución, «Rutas y dominios», «Cabeceras» y principio XI; contracts/api-v1.md 1.8;
// contracts/web-routes.md 1.4 y 1.8). `handle` aplica el orden de la constitución: contexto → host → origen
// (solo web) → Paraglide → apariencia → app → sesión → cabeceras de seguridad.
import { building } from '$app/environment';
import {
	isHttpError,
	type Handle,
	type HandleServerError,
	type RequestEvent,
	type ServerInit
} from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { sequence } from '@sveltejs/kit/hooks';
import { dirname, join } from 'node:path';
import * as m from '$lib/paraglide/messages.js';
import { paraglideMiddleware } from '$lib/paraglide/server.js';
import { appearanceAttributes, appearanceFromCookies } from '$lib/appearance/preferences';
import { createComposition, type Composition } from '$lib/server/composition';
import { sessionUserOf } from '$lib/server/features/accounts';
import { activeAppOrigins, appHeadersOf, resolveAppBySlug } from '$lib/server/features/apps';
import { bearerOnlyHeaders } from '$lib/server/api/session';
import { apiErrorResponse } from '$lib/server/api/errors';
import { getComposition, setComposition } from '$lib/server/composition.cache';
import { readEnv } from '$lib/server/config/env';
import { EnvConfigError, type Env } from '$lib/server/config/env-schema';
import { migrateDatabase } from '$lib/server/db/migrate';
import { seedDefaults } from '$lib/server/seed';
import { createRootLogger, type LogContext } from '$lib/server/logging/logger';
import { createLogSink } from '$lib/server/logging/outputs';
import { APP_VERSION } from '$lib/version';

const API_PREFIX = '/api/v1/';
const HEALTH_PATH = '/api/v1/health';
const UNSAFE_METHODS: readonly string[] = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const FORM_CONTENT_TYPES: readonly string[] = Object.freeze([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
]);

const SHUTDOWN_REASONS: Readonly<Record<string, 'sigterm' | 'sigint' | 'idle'>> = Object.freeze({
	SIGTERM: 'sigterm',
	SIGINT: 'sigint',
	IDLE: 'idle'
});

export const init: ServerInit = async () => {
	if (building) return;

	const bootstrap = createRootLogger({
		level: 'fatal',
		env: 'unknown',
		version: APP_VERSION,
		sink: process.stderr
	});

	let config: Env;
	try {
		config = readEnv();
	} catch (cause) {
		if (!(cause instanceof EnvConfigError)) throw cause;
		bootstrap.emit('app.config.invalid', { count: cause.names.length });
		process.stderr.write(`Variables de entorno ausentes o inválidas: ${cause.names.join(', ')}\n`);
		process.exit(1);
	}

	const sink = await createLogSink({
		development: config.APP_ENV === 'development',
		logDir: '.logs'
	});
	const logger = createRootLogger({
		level: config.LOG_LEVEL,
		env: config.APP_ENV,
		version: APP_VERSION,
		sink
	});

	const composition = createComposition(config, logger, { requestEvent: getRequestEvent });
	try {
		await migrateDatabase({
			sqlite: composition.sqlite,
			db: composition.db,
			migrationsFolder: 'drizzle',
			databasePath: config.DATABASE_PATH,
			backupDir: join(dirname(config.DATABASE_PATH), 'pre-migrate'),
			keepBackups: 3,
			version: APP_VERSION,
			logger
		});
	} catch {
		// El evento `app.db.migration_failed` ya está registrado; el proceso no arranca.
		composition.close();
		process.exit(1);
	}
	try {
		seedDefaults(composition.db, composition.clock, composition.ids);
	} catch (cause) {
		logger.emit('app.db.seed_failed', { err: cause });
		composition.close();
		process.exit(1);
	}

	setComposition(composition);
	// Las reservas de créditos aún no existen (llegan con L02): no se libera ninguna al arrancar.
	logger.emit('app.started', { count: 0 });

	process.on('sveltekit:shutdown', (reason: unknown) => {
		logger.emit('app.stopping', { reason: shutdownReason(reason) });
		composition.close();
	});
};

function shutdownReason(value: unknown): 'sigterm' | 'sigint' | 'idle' {
	const reason = typeof value === 'string' ? SHUTDOWN_REASONS[value] : undefined;
	return reason ?? 'sigterm';
}

interface Hosts {
	readonly api: string;
	readonly web: string;
	readonly webOrigin: string;
}

function hostsOf(config: Composition['config']): Hosts {
	const api = new URL(config.PUBLIC_API_URL);
	const web = new URL(config.PUBLIC_WEB_URL);
	return { api: api.host, web: web.host, webOrigin: web.origin };
}

/** Contexto de la petición: identificador, logger hijo, `X-Request-Id` y una línea al terminar. */
const requestContext: Handle = async ({ event, resolve }) => {
	const requestId = crypto.randomUUID();
	const context: LogContext = {
		requestId,
		method: event.request.method,
		...(event.route.id === null ? {} : { route: event.route.id })
	};
	const log = getComposition().logger.child(context);
	event.locals.requestId = requestId;
	event.locals.log = log;

	const started = performance.now();
	let httpStatus = 500;
	try {
		const response = await resolve(event);
		httpStatus = response.status;
		response.headers.set('x-request-id', requestId);
		setSecurityHeaders(response);
		return response;
	} catch (cause) {
		if (isHttpError(cause)) httpStatus = cause.status;
		throw cause;
	} finally {
		const isHealth = event.url.pathname === HEALTH_PATH;
		log.emit(
			'http.request.completed',
			{
				route: event.route.id ?? '',
				method: event.request.method,
				httpStatus,
				durationMs: Math.round(performance.now() - started)
			},
			isHealth ? { level: 'debug' } : undefined
		);
	}
};

/** Separación por host: la API solo responde a `/api/v1/*` y la web al resto (`/api/v1/health`, aparte). */
const hostSeparation: Handle = ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname === HEALTH_PATH) return resolve(event);

	const hosts = hostsOf(getComposition().config);
	if (hosts.api === hosts.web) return resolve(event);

	const isApiPath = pathname.startsWith(API_PREFIX);
	const onApi = event.url.host === hosts.api && isApiPath;
	const onWeb = event.url.host === hosts.web && !isApiPath;
	if (onApi || onWeb) return resolve(event);

	event.locals.log.emit('http.host.rejected', { reason: 'host_mismatch' });
	return new Response(null, { status: 404 });
};

/** Comprobación de origen propia del host web (D-01): formularios sin `Origin` del propio sitio → 403. */
const originCheck: Handle = ({ event, resolve }) => {
	if (event.url.pathname.startsWith(API_PREFIX)) return resolve(event);
	if (!UNSAFE_METHODS.includes(event.request.method) || !isFormRequest(event.request)) {
		return resolve(event);
	}

	const { webOrigin } = hostsOf(getComposition().config);
	const origin = event.request.headers.get('origin');
	const reason =
		origin === null ? 'origin_missing' : origin === webOrigin ? null : 'origin_mismatch';
	if (reason === null) return resolve(event);

	event.locals.log.emit('http.origin.rejected', { reason, httpStatus: 403 });
	return rejectedFormResponse(event.locals.requestId);
};

/** Página mínima de 403 con el código de referencia: la respuesta sale del contexto, con su cabecera. */
function rejectedFormResponse(requestId: string): Response {
	const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${m.errors_forbidden()}</title></head><body><main><h1>${m.errors_forbidden()}</h1><p>${m.errors_reference_code()}: <code>${requestId}</code></p></main></body></html>`;
	return new Response(html, {
		status: 403,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});
}

function isFormRequest(request: Request): boolean {
	const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
	return type !== undefined && FORM_CONTENT_TYPES.includes(type);
}

/** Paraglide: idioma de la petición y `lang`/`dir` de la página. Solo `es` (baseLocale). */
const localization: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html.replace('%paraglide.lang%', locale).replace('%paraglide.dir%', 'ltr')
		});
	});

/** Tema y efectos desde las cookies, pintados en `<html>` para que no haya destello (DS-02). */
const appearance: Handle = ({ event, resolve }) => {
	const current = appearanceFromCookies((name) => event.cookies.get(name));
	event.locals.appearance = current;
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%mdm.appearance%', appearanceAttributes(current))
	});
};

/** Rutas de la API que no exigen `X-App-Id` (contracts/api-v1.md 1.2): el _healthcheck_ y el documento OpenAPI. */
const APP_EXEMPT_PATHS: readonly string[] = Object.freeze([HEALTH_PATH, '/api/v1/openapi.json']);

/**
 * Identificación de la app (`X-App-Id`, BE-FR-62 CA1–CA2; T130). Solo en la API. Sin app válida, `400 UNKNOWN_APP`; una
 * app desactivada, `503 APP_DISABLED`. El _preflight_ de CORS no lleva `X-App-Id` y pasa sin resolver la app.
 */
const appStep: Handle = ({ event, resolve }) => {
	event.locals.app = null;
	event.locals.appRejection = null;
	const { pathname } = event.url;
	if (!pathname.startsWith(API_PREFIX) || APP_EXEMPT_PATHS.includes(pathname))
		return resolve(event);
	if (event.request.method === 'OPTIONS') return resolve(event);

	// No rechaza aquí: una ruta inexistente debe seguir dando `404 NOT_FOUND`. Cada ruta que necesita la app la exige con
	// `requireApp`, que responde `UNKNOWN_APP` o `APP_DISABLED` según `appRejection`.
	const header = appHeadersOf(event.request.headers);
	const app = header.ok ? resolveAppBySlug(getComposition().apps, header.appId) : undefined;
	if (app === undefined) {
		event.locals.appRejection = 'unknown_app';
		return resolve(event);
	}
	if (app.status === 'disabled') {
		event.locals.appRejection = 'app_disabled';
		return resolve(event);
	}
	event.locals.app = {
		id: app.id,
		slug: app.slug,
		name: app.name,
		allowedOrigins: app.allowedOrigins,
		version: header.ok ? header.version : null,
		deviceName: header.ok ? header.deviceName : null
	};
	return resolve(event);
};

const CORS_EXPOSED_HEADERS = 'X-Request-Id, Retry-After';
const CORS_PREFLIGHT_HEADERS =
	'Authorization, Content-Type, X-App-Id, X-App-Version, X-Device-Name, Idempotency-Key, If-Match';

/** Cabeceras CORS de una respuesta a un origen permitido. Nunca `*` ni credenciales (BE-FR-65 CA2). */
function corsHeaders(origin: string): Record<string, string> {
	return {
		'access-control-allow-origin': origin,
		vary: 'Origin',
		'access-control-expose-headers': CORS_EXPOSED_HEADERS
	};
}

/**
 * CORS por app (BE-FR-65 CA2, D-19; T131). Solo en la API y solo con `Origin` (el escritorio no lo envía). El _preflight_
 * se responde si el origen figura en alguna app activa; una petición real, si figura en la app de `X-App-Id`.
 */
const corsStep: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin');
	if (!event.url.pathname.startsWith(API_PREFIX) || origin === null) return resolve(event);

	if (event.request.method === 'OPTIONS') {
		if (activeAppOrigins(getComposition().apps).includes(origin)) {
			return new Response(null, {
				status: 204,
				headers: {
					...corsHeaders(origin),
					'access-control-allow-headers': CORS_PREFLIGHT_HEADERS,
					'access-control-allow-methods': 'GET, POST, PUT',
					'access-control-max-age': '600'
				}
			});
		}
		event.locals.log.emit('http.cors.rejected', {
			reason: 'origin_not_allowed',
			errorCode: 'ORIGIN_NOT_ALLOWED'
		});
		return apiErrorResponse('ORIGIN_NOT_ALLOWED');
	}

	const app = event.locals.app;
	if (app === null) return resolve(event);
	if (!app.allowedOrigins.includes(origin)) {
		event.locals.log.emit('http.cors.rejected', {
			reason: 'origin_not_allowed',
			errorCode: 'ORIGIN_NOT_ALLOWED'
		});
		return apiErrorResponse('ORIGIN_NOT_ALLOWED');
	}
	const response = await resolve(event);
	for (const [name, value] of Object.entries(corsHeaders(origin))) {
		response.headers.set(name, value);
	}
	return response;
};

/**
 * Sesión de usuario (BE-FR-03, FR-018; contracts/web-routes.md 1.2). En la web, solo la cookie de sesión: un
 * `Authorization: Bearer` se ignora y se registra. El host de la API no lee cookies (su autenticación llega en L04).
 */
const sessionStep: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	if (event.url.pathname.startsWith(API_PREFIX)) {
		// La API solo lee la sesión del Bearer; una cookie se ignora y se registra (BE-FR-65 CA3). El host de la API no
		// escribe cookies: ninguna respuesta de API lleva `set-cookie` (T098).
		if (event.request.headers.has('cookie')) {
			event.locals.log.emit('accounts.session.rejected', {
				reason: 'cookie_on_api',
				errorCode: 'UNAUTHENTICATED'
			});
		}
		if (event.request.headers.has('authorization')) {
			await loadSession(event, bearerOnlyHeaders(event.request.headers));
		}
		const response = await resolve(event);
		response.headers.delete('set-cookie');
		return response;
	}
	if (event.request.headers.has('authorization')) {
		event.locals.log.emit('accounts.session.rejected', {
			reason: 'bearer_on_web',
			errorCode: 'UNAUTHENTICATED'
		});
		return resolve(event);
	}
	await loadSession(event, event.request.headers);
	return resolve(event);
};

/** Carga la sesión de las cabeceras dadas en `locals`; sin sesión válida, lo deja en `null`. */
async function loadSession(event: RequestEvent, headers: Headers): Promise<void> {
	const current = await getComposition().accounts.readSession(headers);
	if (current === null) return;
	event.locals.user = sessionUserOf(current.user);
	event.locals.session = {
		id: current.session.id,
		appId: typeof current.session.appId === 'string' ? current.session.appId : null
	};
}

const REGISTER_PATH = '/registro';
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Añade el origen de Turnstile a `script-src` y `frame-src` de una política CSP; el resto de la política no cambia. */
function withTurnstile(policy: string): string {
	const directives = policy
		.split(';')
		.map((directive) => directive.trim())
		.filter((directive) => directive !== '');
	for (const name of ['script-src', 'frame-src']) {
		const present = directives.some((directive) => directive.split(' ')[0] === name);
		if (!present) {
			directives.push(`${name} 'self' ${TURNSTILE_ORIGIN}`);
			continue;
		}
		for (let index = 0; index < directives.length; index += 1) {
			const directive = directives[index] ?? '';
			if (directive.split(' ')[0] === name) directives[index] = `${directive} ${TURNSTILE_ORIGIN}`;
		}
	}
	return directives.join('; ');
}

/** Turnstile solo en el registro (FR-102; constitución): su origen entra en la CSP de esa página y de ninguna otra. */
const turnstileCsp: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (event.url.pathname !== REGISTER_PATH) return response;
	const policy = response.headers.get('content-security-policy');
	if (policy !== null) response.headers.set('content-security-policy', withTurnstile(policy));
	return response;
};

/** Cabeceras de seguridad de toda respuesta (la CSP de página la pone SvelteKit en las páginas). */
function setSecurityHeaders(response: Response): void {
	response.headers.set('strict-transport-security', 'max-age=31536000');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

export const handle: Handle = sequence(
	requestContext,
	hostSeparation,
	originCheck,
	localization,
	appearance,
	appStep,
	corsStep,
	sessionStep,
	turnstileCsp
);

/** Un solo registro para los errores inesperados; al usuario solo le llega un texto genérico. */
export const handleError: HandleServerError = ({ error: cause, event, status }) => {
	const { log, requestId } = event.locals;
	if (status >= 500) {
		log.emit('http.request.failed', {
			route: event.route.id ?? '',
			method: event.request.method,
			httpStatus: status,
			err: cause
		});
	}
	return { message: messageFor(status), requestId };
};

function messageFor(status: number): string {
	if (status === 403) return m.errors_forbidden();
	if (status === 404) return m.errors_not_found();
	return m.errors_unexpected();
}
