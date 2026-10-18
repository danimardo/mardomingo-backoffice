// Lectura de las apps para la administración (W39–W40; T310). Solo lectura: las escrituras pasan por `createApp`,
// `updateAppOverrides` y `createOperation`, que validan y auditan.
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Capabilities } from './json-schemas';
import { apps, appOperations } from './schema';

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

export interface AdminOperationRow {
	readonly id: string;
	readonly key: string;
	readonly kind: 'chat' | 'transcription' | 'image';
	readonly mode: 'libre' | 'plantilla';
	readonly model: string | null;
	readonly active: boolean;
	readonly capabilities: Capabilities;
	readonly estimatedMaxCostMicroUsd: number | null;
	readonly timeoutMs: number;
	readonly groupLabel: string | null;
	readonly maxOutputTokens: number | null;
	readonly temperatureMilli: number;
	readonly maxCostMicro: number;
}

/** Una operación de una app para la ficha de W41 (solo lectura). */
export function operationForAdmin(
	deps: { readonly db: Db },
	appId: string,
	key: string
): AdminOperationRow | null {
	return (
		deps.db
			.select({
				id: appOperations.id,
				key: appOperations.key,
				kind: appOperations.kind,
				mode: appOperations.mode,
				model: appOperations.model,
				active: appOperations.active,
				capabilities: appOperations.capabilities,
				estimatedMaxCostMicroUsd: appOperations.estimatedMaxCostMicroUsd,
				timeoutMs: appOperations.timeoutMs,
				maxOutputTokens: appOperations.maxOutputTokens,
				temperatureMilli: appOperations.temperatureMilli,
				maxCostMicro: appOperations.maxCostMicro,
				groupLabel: appOperations.groupLabel
			})
			.from(appOperations)
			.where(and(eq(appOperations.appId, appId), eq(appOperations.key, key)))
			.get() ?? null
	);
}

/** Operaciones de la misma app con la misma etiqueta de grupo (W41: aplicar al grupo). Solo lectura. */
export function operationsInGroup(
	deps: { readonly db: Db },
	appId: string,
	groupLabel: string
): { readonly id: string; readonly key: string }[] {
	return deps.db
		.select({ id: appOperations.id, key: appOperations.key })
		.from(appOperations)
		.where(and(eq(appOperations.appId, appId), eq(appOperations.groupLabel, groupLabel)))
		.orderBy(asc(appOperations.key))
		.all();
}
