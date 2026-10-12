// Visibilidad de un anuncio para una app (BE-FR-85 CA1–CA2, FR-076; T192). Puro: sin I/O ni otras funcionalidades.
import { inRange } from '$lib/server/shared/semver';

export interface AnnouncementRow {
	readonly id: string;
	/** `null` = todas las apps. */
	readonly appId: string | null;
	readonly level: 'info' | 'warning' | 'critical';
	readonly message: string;
	readonly link: string | null;
	readonly startsAt: number;
	/** Fin exclusivo; `null` = sin fin. */
	readonly endsAt: number | null;
	readonly minVersion: string | null;
	readonly maxVersion: string | null;
	readonly active: boolean;
}

/**
 * Un anuncio se ve si está activo, es de la app o de todas, está vigente (desde su inicio hasta su fin, exclusivo) y su
 * rango de versiones contiene la versión. Sin versión, solo se ven los que no tienen rango.
 */
export function isVisible(
	row: AnnouncementRow,
	input: { readonly appId: string; readonly version: string | null; readonly now: number }
): boolean {
	if (!row.active) return false;
	if (row.appId !== null && row.appId !== input.appId) return false;
	if (row.startsAt > input.now) return false;
	if (row.endsAt !== null && row.endsAt <= input.now) return false;
	if (row.minVersion === null && row.maxVersion === null) return true;
	return inRange(input.version, { min: row.minVersion, max: row.maxVersion });
}
