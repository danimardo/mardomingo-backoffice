// Lectura de las descargas de los releases del periodo para el embudo (W45; BE-FR-54; T318–T319). La escribe la tarea diaria (L14)
// y es tabla propia de `stats`. Solo cuenta días con dato: un día sin descargas registradas no es cero (se omite).
import { and, gte, isNotNull, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { CivilDate } from '$lib/shared/time';
import { releaseDownloads } from './schema';

export interface DownloadFact {
	readonly appId: string;
	/** Día civil de la medición (`AAAA-MM-DD`), para agrupar el embudo por semana (T320). */
	readonly day: string;
	readonly downloads: number;
}

/** Días civiles inclusive del filtro (`desde` y `hasta`, tal como los escribe el administrador). */
export function releaseDownloadsBetween(
	db: Pick<Db, 'select'>,
	period: { readonly fromDay: CivilDate; readonly toDay: CivilDate }
): DownloadFact[] {
	const rows = db
		.select({
			appId: releaseDownloads.appId,
			day: releaseDownloads.day,
			downloads: releaseDownloads.downloads
		})
		.from(releaseDownloads)
		.where(
			and(
				gte(releaseDownloads.day, period.fromDay),
				lte(releaseDownloads.day, period.toDay),
				isNotNull(releaseDownloads.downloads)
			)
		)
		.all();
	return rows.flatMap((row) =>
		row.downloads === null ? [] : [{ appId: row.appId, day: row.day, downloads: row.downloads }]
	);
}
