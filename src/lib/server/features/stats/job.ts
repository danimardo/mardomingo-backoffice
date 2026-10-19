// Tareas de estadísticas (L14; BE-FR-54, BE-FR-73): descargas diarias de los instaladores y precios orientativos. Las programa
// `jobs/` con croner; cada una es idempotente por día (la clave primaria de `release_downloads` y el recálculo del precio no
// duplican nada), así que repetirla tras un reinicio es seguro.
import { and, eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import type { Logger } from '$lib/server/logging/logger';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs, type CivilDate } from '$lib/shared/time';
import { releaseDownloads } from './schema';
import { downloadsSinceYesterday, priceReference, totalReleaseDownloads } from './domain/daily-job';

export interface ReleaseSource {
	readonly slug: string;
	readonly repo: string;
}

export interface Release {
	readonly assets: readonly { readonly download_count: number }[];
}

export interface StatsTasksDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly releaseSources: readonly ReleaseSource[];
	readonly appIdOfSlug: (slug: string) => string | null;
	readonly fetchReleases: (repo: string) => Promise<readonly Release[]>;
	readonly priceSamples: (period: {
		readonly fromMs: number;
		readonly toMs: number;
	}) => { operationId: string; costMicroUsd: number }[];
	readonly manualPriceOf: (operationId: string) => number | null;
	readonly savePriceReference: (input: {
		readonly operationId: string;
		readonly typicalMicro: number | null;
		readonly source: 'auto' | 'manual' | null;
		readonly sampleSize: number;
		readonly computedAt: number;
	}) => void;
	readonly priceWindowDays: () => number;
	readonly priceMinSamples: () => number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Descargas del día de cada app con release: acumulado de GitHub y diferencia con el día anterior (la primera lectura no tiene
 * diferencia). Un repositorio que falla no impide consultar los demás: se registra y la tarea sigue. Devuelve cuántas apps se
 * consultaron con éxito.
 */
export async function runDownloads(deps: StatsTasksDeps): Promise<number> {
	const now = toEpochMs(deps.clock.now());
	const day: CivilDate = civilDateOf(now);
	let fetched = 0;
	for (const source of deps.releaseSources) {
		const appId = deps.appIdOfSlug(source.slug);
		if (appId === null) continue;
		let releases: readonly Release[];
		try {
			releases = await deps.fetchReleases(source.repo);
		} catch (error) {
			deps.logger.emit('stats.downloads.fetch_failed', { provider: 'github', err: error });
			continue;
		}
		const cumulative = totalReleaseDownloads(releases);
		const yesterday = toEpochMs(now - DAY_MS);
		const previous = deps.db
			.select({ cumulative: releaseDownloads.cumulativeDownloads })
			.from(releaseDownloads)
			.where(
				and(eq(releaseDownloads.appId, appId), eq(releaseDownloads.day, civilDateOf(yesterday)))
			)
			.get();
		deps.db
			.insert(releaseDownloads)
			.values({
				appId,
				day,
				cumulativeDownloads: cumulative,
				downloads: downloadsSinceYesterday(cumulative, previous?.cumulative ?? null),
				fetchedAt: now
			})
			.onConflictDoNothing()
			.run();
		fetched += 1;
	}
	if (fetched > 0)
		deps.logger.emit('stats.downloads.fetched', { provider: 'github', count: fetched });
	return fetched;
}

/** Precio de referencia de cada operación con muestras en la ventana (BE-FR-73): mediana, mínimo de muestras, valor manual manda. */
export function runPrices(deps: StatsTasksDeps): number {
	const now = toEpochMs(deps.clock.now());
	const windowStart = now - deps.priceWindowDays() * DAY_MS;
	const samples = deps.priceSamples({ fromMs: windowStart, toMs: now });
	const byOperation = new Map<string, number[]>();
	for (const sample of samples) {
		const list = byOperation.get(sample.operationId) ?? [];
		list.push(sample.costMicroUsd);
		byOperation.set(sample.operationId, list);
	}
	for (const [operationId, costs] of byOperation) {
		const price = priceReference({
			costsMicroUsd: costs,
			minSamples: deps.priceMinSamples(),
			manualMicro: deps.manualPriceOf(operationId)
		});
		deps.savePriceReference({
			operationId,
			typicalMicro: price?.typicalMicro ?? null,
			source: price?.source ?? null,
			sampleSize: costs.length,
			computedAt: now
		});
	}
	return byOperation.size;
}
