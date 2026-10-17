// Lectura de las apps para la administración (W39–W40; T310). Solo lectura: las escrituras pasan por `createApp`,
// `updateAppOverrides` y `createOperation`, que validan y auditan.
import { asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { apps } from './schema';

export interface AdminAppRow {
	readonly id: string;
	readonly slug: string;
	readonly name: string;
	readonly status: string;
	readonly description: string | null;
	readonly supportEmail: string | null;
}

export function listAppsForAdmin(deps: { readonly db: Db }): AdminAppRow[] {
	return deps.db
		.select({
			id: apps.id,
			slug: apps.slug,
			name: apps.name,
			status: apps.status,
			description: apps.description,
			supportEmail: apps.supportEmail
		})
		.from(apps)
		.orderBy(asc(apps.name))
		.all();
}

export function appForAdmin(deps: { readonly db: Db }, slug: string): AdminAppRow | null {
	return (
		deps.db
			.select({
				id: apps.id,
				slug: apps.slug,
				name: apps.name,
				status: apps.status,
				description: apps.description,
				supportEmail: apps.supportEmail
			})
			.from(apps)
			.where(eq(apps.slug, slug))
			.get() ?? null
	);
}
