// API pública de `stats` (ARCHITECTURE.md §4): estadísticas de un periodo, compuestas desde las API públicas de `payments` y `ai`.
export { statsForPeriod, type PeriodStats, type DayStats, type StatsDeps } from './service';
export {
	funnel,
	grossMargin,
	groupSum,
	usdMicroToEurCents,
	type FunnelStage
} from './domain/metrics';
