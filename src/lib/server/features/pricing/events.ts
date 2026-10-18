// Catálogo de eventos de `pricing` (contracts/log-events.md; T152). Sin importes ni tipos en los campos: solo motivos.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface PricingLogFields {
	'pricing.price.manual_set': { cleared: boolean };
	'pricing.fx.refreshed': Record<string, never>;
	'pricing.fx.refresh_failed': { reason: 'unavailable' | 'invalid' | 'http' | 'stale_observation' };
	'pricing.fx.manual_set': Record<string, never>;
	'pricing.fx.manual_cleared': Record<string, never>;
}

export const PRICING_LOG_EVENTS = Object.freeze({
	'pricing.price.manual_set': { level: 'info', msg: 'Precio orientativo manual fijado o quitado' },
	'pricing.fx.refreshed': { level: 'info', msg: 'Tipo de cambio actualizado desde el BCE' },
	'pricing.fx.refresh_failed': {
		level: 'warn',
		msg: 'No se ha podido actualizar el tipo de cambio'
	},
	'pricing.fx.manual_set': { level: 'info', msg: 'Tipo de cambio manual fijado' },
	'pricing.fx.manual_cleared': { level: 'info', msg: 'Tipo de cambio manual desactivado' }
} as const satisfies Record<keyof PricingLogFields, LogEventMeta>);
