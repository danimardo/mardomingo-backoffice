import { compareParts, parseVersion } from '$lib/server/shared/semver';

// Reglas de acceso de `protections` (FR-073, FR-074, BE-FR-47, BE-FR-48 CA1, D-19; T190). Puro: sin I/O ni otras
// funcionalidades. Cada endpoint declara si exige versión mínima y si lo bloquea el mantenimiento (api-v1 1.8).

export type EndpointName =
	| 'auth.login'
	| 'auth.resend_verification'
	| 'auth.logout'
	| 'app.status'
	| 'me'
	| 'me.accept_terms'
	| 'defaults'
	| 'sync'
	| 'ai';

export interface EndpointCheck {
	readonly version: boolean;
	readonly maintenance: boolean;
}

/** Qué comprobaciones aplica cada endpoint (api-v1 1.8 y D-19). Congelado: es configuración, no estado. */
export const ENDPOINT_CHECKS: Readonly<Record<EndpointName, EndpointCheck>> = Object.freeze({
	'auth.login': { version: false, maintenance: false },
	'auth.resend_verification': { version: false, maintenance: false },
	'auth.logout': { version: false, maintenance: false },
	'app.status': { version: false, maintenance: false },
	me: { version: true, maintenance: false },
	'me.accept_terms': { version: true, maintenance: false },
	defaults: { version: true, maintenance: false },
	sync: { version: true, maintenance: true },
	ai: { version: true, maintenance: true }
});

export type VersionVerdict =
	{ readonly ok: true } | { readonly ok: false; readonly reason: 'upgrade_required' };

/**
 * Versión mínima (`enforce_version`): una versión menor que la mínima, o ausente, exige actualizar (426). Los endpoints
 * exentos no se comprueban nunca (logout, /app/status).
 */
export function versionVerdict(input: {
	readonly endpoint: EndpointName;
	readonly appVersion: string | null;
	readonly enforce: boolean;
	readonly minAppVersion: string | null;
}): VersionVerdict {
	if (!ENDPOINT_CHECKS[input.endpoint].version || !input.enforce || input.minAppVersion === null) {
		return { ok: true };
	}
	const current = parseVersion(input.appVersion);
	const minimum = parseVersion(input.minAppVersion);
	if (current === null || minimum === null) return { ok: false, reason: 'upgrade_required' };
	return compareParts(current, minimum) >= 0
		? { ok: true }
		: { ok: false, reason: 'upgrade_required' };
}

export type MaintenanceVerdict =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly reason: 'maintenance_global' | 'maintenance_app';
			readonly message: string;
	  };

/**
 * Mantenimiento: el global bloquea primero y con su mensaje; si no está activo, el de la app. Los endpoints exentos
 * pasan siempre (login, /me, aceptación de términos y /defaults, D-19).
 */
export function maintenanceVerdict(input: {
	readonly endpoint: EndpointName;
	readonly global: { readonly active: boolean; readonly message: string };
	readonly app: { readonly active: boolean; readonly message: string };
}): MaintenanceVerdict {
	if (!ENDPOINT_CHECKS[input.endpoint].maintenance) return { ok: true };
	if (input.global.active)
		return { ok: false, reason: 'maintenance_global', message: input.global.message };
	if (input.app.active) return { ok: false, reason: 'maintenance_app', message: input.app.message };
	return { ok: true };
}
