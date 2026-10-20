// API pública de `pricing` (ARCHITECTURE.md §4). Las demás funcionalidades y las rutas solo importan este fichero.
export {
	chargeFor,
	clearManualFx,
	getCurrentFxRate,
	refreshFxFromEcb,
	setManualFx,
	usdEurPpmOf,
	savePriceReference,
	manualPriceFor,
	setManualPrice,
	type PricingDeps,
	type Provider,
	type RefreshOutcome
} from './service';
export { publicPricePage } from './public-prices';
export type { PricePage, PriceOperation } from './presenters';
export { PRICING_LOG_EVENTS, type PricingLogFields } from './events';
export {
	estimateChatMicroUsd,
	estimateImageMicroUsd,
	estimateTranscriptionMicroUsd,
	canActivateOperation,
	checkMaxCost,
	type ModelPrice
} from './domain/estimate';
