// Tarea diaria (L14; BE-FR-54, BE-FR-73, BE-FR-16, BE-FR-71). Un día civil de Madrid corre una sola vez: la clave primaria de
// `daily_job_runs` es el bloqueo. Cada paso va aislado: si uno falla, se registra y los demás siguen; la ejecución queda `partial`.
// Pasos: (1) descargas de los releases de cada app, (2) precios de referencia, (3) caducidad de saldo y reservas abiertas.
import { and, eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';
import { dailyJobRuns, releaseDownloads } from './schema';
import { downloadsSinceYesterday, priceReference, totalReleaseDownloads } from './domain/daily-job';

export interface ReleaseSource {
	readonly slug: string;
	readonly repo: string;
}

export interface Release {
	readonly assets: readonly { readonly download_count: number }[];
}

export interface DailyJobDeps {
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
	readonly expireBuckets: () => number;
	readonly expireHolds: () => number;
}

export type DailyJobOutcome = 'ran' | 'already_ran';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Abre la ejecución del día. Si ya existe (la clave primaria choca), otro proceso la tiene o ya terminó: no se repite. */
function claimDay(deps: DailyJobDeps, day: CivilDate, now: EpochMs): boolean {
	try {
		immediateTransaction(deps.db, (tx) => {
			tx.insert(dailyJobRuns).values({ day, startedAt: now }).run();
		});
		return true;
	} catch {
		return false;
	}
}

function finishDay(deps: DailyJobDeps, day: CivilDate, outcome: 'ok' | 'partial'): void {
	immediateTransaction(deps.db, (tx) => {
		tx.update(dailyJobRuns)
			.set({ finishedAt: toEpochMs(deps.clock.now()), outcome })
			.where(eq(dailyJobRuns.day, day))
			.run();
	});
}

/** Ejecuta la tarea del día actual si aún no corrió. Devuelve si corrió o si ya estaba hecha. Nunca lanza por un paso fallido. */
export async function runDailyJob(deps: DailyJobDeps): Promise<DailyJobOutcome> {
	const now = toEpochMs(deps.clock.now());
	const day = civilDateOf(now);
	if (!claimDay(deps, day, now)) return 'already_ran';
	deps.logger.emit('stats.daily_job.started', {});

	let failed = 0;
	const step = async (name: string, run: () => void | Promise<void>): Promise<void> => {
		try {
			await run();
		} catch (error) {
			failed += 1;
			deps.logger.emit('stats.daily_job.step_failed', { step: name, err: error });
		}
	};

	await step('descargas', async () => {
		await recordDownloads(deps, day, now);
	});
	await step('precios', () => {
		recordPrices(deps, now);
	});
	await step('caducidades', () => {
		deps.expireBuckets();
		deps.expireHolds();
	});

	finishDay(deps, day, failed === 0 ? 'ok' : 'partial');
	deps.logger.emit('stats.daily_job.finished', { failed });
	return 'ran';
}

/** Descargas del día de cada app con release: acumulado de GitHub y diferencia con el día anterior. */
async function recordDownloads(deps: DailyJobDeps, day: CivilDate, now: EpochMs): Promise<void> {
	for (const source of deps.releaseSources) {
		const appId = deps.appIdOfSlug(source.slug);
		if (appId === null) continue;
		const releases = await deps.fetchReleases(source.repo);
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
	}
}

/** Precio de referencia de cada operación con muestras en la ventana (BE-FR-73): mediana, mínimo de muestras, valor manual manda. */
function recordPrices(deps: DailyJobDeps, now: EpochMs): void {
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
}
