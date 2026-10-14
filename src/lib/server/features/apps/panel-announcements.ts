// Anuncios del panel (T260; BE-FR-85/CA1). La tabla es de `apps`: aquí se lee, no en `notifications`, para respetar la dueña de la
// tabla. Solo activos y vigentes; sin filtrar por versión (aclaración 2026-10-10): global o de una app de la lista de la cuenta.
import { and, desc, eq, gt, isNull, lte, or, inArray } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { announcements, apps } from './schema';

export interface PanelAnnouncement {
	readonly id: string;
	readonly level: 'info' | 'warning' | 'critical';
	readonly message: string;
	readonly link: string | null;
	readonly appName: string | null;
}

export function announcementsForPanel(
	deps: { readonly db: Db },
	appIds: readonly string[],
	now: EpochMs
): PanelAnnouncement[] {
	const scope =
		appIds.length === 0
			? isNull(announcements.appId)
			: or(isNull(announcements.appId), inArray(announcements.appId, [...appIds]));
	const rows = deps.db
		.select({
			id: announcements.id,
			level: announcements.level,
			message: announcements.message,
			link: announcements.link,
			appId: announcements.appId
		})
		.from(announcements)
		.where(
			and(
				eq(announcements.active, true),
				lte(announcements.startsAt, now),
				or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
				scope
			)
		)
		.orderBy(desc(announcements.startsAt), desc(announcements.id))
		.all();
	const rowAppIds = rows.flatMap((row) => (row.appId === null ? [] : [row.appId]));
	const names = new Map(
		rowAppIds.length === 0
			? []
			: deps.db
					.select({ id: apps.id, name: apps.name })
					.from(apps)
					.where(inArray(apps.id, [...rowAppIds]))
					.all()
					.map((row) => [row.id, row.name] as const)
	);
	return rows.map((row) => ({
		id: row.id,
		level: row.level,
		message: row.message,
		link: row.link,
		appName: row.appId === null ? null : (names.get(row.appId) ?? null)
	}));
}
