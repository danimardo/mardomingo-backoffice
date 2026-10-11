// Protecciones de la API (FR-073, FR-074, BE-FR-47, BE-FR-48 CA1; T191): versión mínima y mantenimiento. Se componen
// desde el servicio de `ai` (pasos 6 y 7 de §8), nunca desde las rutas ni desde el cierre de sesión o `/app/status`.
import type { AppsDeps } from '$lib/server/features/apps';
import { appAccessOf } from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import { maintenanceVerdict, versionVerdict, type EndpointName } from './domain/access';

export interface ProtectionsDeps {
	readonly apps: AppsDeps;
	readonly logger: Logger;
}

/**
 * Comprueba la versión mínima y después el mantenimiento de un endpoint de la app. Lanza `UPGRADE_REQUIRED` (426) o
 * `MAINTENANCE` (503) con el texto del administrador. Los endpoints exentos pasan siempre (`ENDPOINT_CHECKS`).
 */
export function guardAccess(
	deps: ProtectionsDeps,
	input: {
		readonly endpoint: EndpointName;
		readonly appId: string;
		readonly appVersion: string | null;
	}
): void {
	const access = appAccessOf(deps.apps, input.appId);
	if (access === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });

	const version = versionVerdict({
		endpoint: input.endpoint,
		appVersion: input.appVersion,
		enforce: access.enforceVersion,
		minAppVersion: access.minAppVersion
	});
	if (!version.ok) {
		deps.logger.emit('protections.request.rejected', { reason: version.reason });
		throw new AppError('UPGRADE_REQUIRED');
	}

	const maintenance = maintenanceVerdict({
		endpoint: input.endpoint,
		global: access.globalMaintenance,
		app: access.maintenance
	});
	if (!maintenance.ok) {
		deps.logger.emit('protections.request.rejected', { reason: maintenance.reason });
		throw new AppError('MAINTENANCE', { message: maintenance.message });
	}
}
