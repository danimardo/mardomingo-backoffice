// Registro de las tareas periódicas (R14, FR-106; T291, T341). Cada tarea es una función fina sobre el servicio de su dueña, que
// ya está probado con reloj falso; aquí solo se enlaza con su horario (`schedule.ts`) y se programa con croner.
import type { Composition } from '$lib/server/composition';
import { getSetting } from '$lib/server/features/apps';
import { emailOfUser } from '$lib/server/features/accounts';
import { sendAccountEmail } from '$lib/server/features/notifications';
import { refreshModelCache } from '$lib/server/features/ai';
import { refreshFxFromEcb } from '$lib/server/features/pricing';
import { runDownloads, runPrices } from '$lib/server/features/stats';
import { runLedgerCheck } from './ledger-check';
import { SCHEDULE, type ScheduledTaskName } from './schedule';
import { toEpochMs } from '$lib/shared/time';
import { runOpenRouterBalance } from './openrouter-balance';
import { runHoldsCleanup } from './holds-cleanup';
import { runFreeCreditsExpiry } from './free-credits-expiry';
import { runDisposableDomains } from './disposable-domains';
import { runTombstonesCleanup } from './sync-tombstones-cleanup';

/** Las claves de los ajustes se conservan 400 días: después no hay formulario abierto que pueda reenviarlas (T307). */
const ADJUSTMENT_KEY_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
import { startTasks, type RunningTasks, type Task } from './run-task';

export { runTask, startTasks, TASK_TIMEZONE } from './run-task';
export type { RunningTasks, Task, TaskName } from './run-task';
export { SCHEDULE, type ScheduledTaskName, type TaskSchedule } from './schedule';

/** Lo que hace cada tarea. Cada una devuelve cuántos elementos trató. */
function runners(composition: Composition): Record<ScheduledTaskName, Task['run']> {
	const { privacy, accounts, credits, apps, sync } = composition;
	return {
		retention: () => {
			const report = privacy.applyRetention();
			return report.sessions + report.aiOperations + report.other;
		},
		'unverified-accounts-cleanup': () =>
			accounts.purgeUnverified(Number(getSetting(apps, 'unverified_account_ttl_days') ?? 7)),
		'inactive-accounts': async () => {
			const report = await privacy.processInactive();
			return report.notified + report.cancelled + report.deleted;
		},
		'free-credits-expiry': () =>
			runFreeCreditsExpiry({
				credits,
				emailOf: (userId) => emailOfUser(composition.db, userId),
				sendWarning: (warning) => sendAccountEmail(composition.notifications, warning),
				warningDays: Number(getSetting(apps, 'free_expiry_warning_days') ?? 7)
			}),
		'holds-cleanup': () => runHoldsCleanup(credits),
		'sync-tombstones-cleanup': () => runTombstonesCleanup(sync),
		'openrouter-balance': async () =>
			(await runOpenRouterBalance({
				gateway: composition.ai.gateway,
				thresholdMicroUsd: Number(getSetting(apps, 'openrouter_balance_alert_usd') ?? 0),
				alerts: composition.pricing.alerts
			})) === 'alert'
				? 1
				: 0,
		'adjustment-keys-cleanup': () =>
			credits.purgeAdjustmentKeys(toEpochMs(composition.clock.now() - ADJUSTMENT_KEY_RETENTION_MS)),
		'ledger-check': () =>
			runLedgerCheck({ credits, alerts: composition.pricing.alerts, db: composition.db }),
		'price-references': () => runPrices(composition.statsTasks),
		'release-downloads': () => runDownloads(composition.statsTasks),
		'models-refresh': async () =>
			(await refreshModelCache(composition.ai)) === 'refreshed' ? 1 : 0,
		'disposable-domains': () =>
			runDisposableDomains({
				db: composition.db,
				logger: composition.logger,
				clock: composition.clock
			}).then((count) => (count > 0 ? 1 : 0)),
		'fx-ecb': async () =>
			(await refreshFxFromEcb(composition.pricing)).status === 'updated' ? 1 : 0
	};
}

/** Las tareas con su horario y su trabajo. Una función pura de la composición: no arranca nada. */
export function buildTasks(composition: Composition): Task[] {
	const run = runners(composition);
	return SCHEDULE.map((entry) => ({ ...entry, run: run[entry.name] }));
}

/** Programa las tareas de la composición. En las pruebas no se llama. */
export function startScheduledTasks(composition: Composition): RunningTasks {
	return startTasks(composition.logger, buildTasks(composition));
}
