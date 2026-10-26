// API pública de `stats` (ARCHITECTURE.md §4): estadísticas de un periodo, compuestas desde las API públicas de `payments` y `ai`.
export {
	statsForPeriod,
	type PeriodStats,
	type DayStats,
	type StatsDeps,
	type StatsGrouping,
	type StatsGroup,
	type StatsOptions
} from './service';
export {
	FUNNEL_MODES,
	FUNNEL_STAGES,
	type FunnelMode,
	type FunnelWeek
} from './domain/funnel-series';
export {
	funnel,
	grossMargin,
	groupSum,
	usdMicroToEurCents,
	type FunnelStage
} from './domain/metrics';

// Tareas de estadísticas (L14): las programa `jobs/`; las pruebas no arrancan el programador.
export { runDownloads, runPrices, type StatsTasksDeps } from './job';
export { STATS_LOG_EVENTS, type StatsLogFields } from './events';
export { releaseDownloadsBetween, type DownloadFact } from './downloads-read';
