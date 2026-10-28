// Catálogo de eventos de la funcionalidad `credits` (contracts/log-events.md 3.6; T124). Los campos llevan motivos, tipos y
// contadores, nunca importes, saldos ni emails (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface CreditsLogFields {
	'credits.hold.created': Record<string, never>;
	'credits.hold.rejected': { reason: 'debt_open' | 'insufficient_balance' | 'daily_free_limit' };
	'credits.hold.released': { reason: 'released' | 'consumed' | 'interrupted' | 'expired' };
	'credits.hold.released_on_startup': { count: number };
	'credits.hold.expired': Record<string, never>;
	'credits.charge.applied': Record<string, never>;
	'credits.debt.created': Record<string, never>;
	'credits.debt.absorbed': Record<string, never>;
	'credits.debt.settled': Record<string, never>;
	'credits.bucket.granted': {
		kind: 'free' | 'paid';
		source: 'welcome' | 'purchase' | 'adjustment';
	};
	'credits.welcome.denied': { reason: 'hash_granted' | 'account_has_welcome' };
	'credits.adjustment.applied': { direction: 'credit' | 'debit'; kind: 'free' | 'paid' };
	'credits.adjustment.rejected': { reason: 'exceeds_available' | 'exceeds_kind' };
	'credits.expiry.applied': { count: number };
	'credits.expiry.warned': { count: number };
	'credits.balance.forfeited': { reason: 'user' | 'inactivity'; count: number };
	'credits.ledger.mismatch': { count: number };
	'credits.refund.applied': Record<string, never>;
	'credits.low_balance.crossed': { status: 'notified' | 'rearmed' };
	'credits.chargeback.applied': Record<string, never>;
}

export const CREDITS_LOG_EVENTS = Object.freeze({
	'credits.hold.created': { level: 'info', msg: 'Reserva de saldo creada' },
	'credits.hold.rejected': { level: 'info', msg: 'Reserva de saldo rechazada' },
	'credits.hold.released': { level: 'info', msg: 'Reserva de saldo liberada' },
	'credits.hold.released_on_startup': {
		level: 'warn',
		msg: 'Reservas abiertas liberadas al arrancar'
	},
	'credits.hold.expired': { level: 'info', msg: 'Reserva caducada por tiempo' },
	'credits.charge.applied': { level: 'info', msg: 'Cobro aplicado' },
	'credits.debt.created': { level: 'info', msg: 'Cobro que pasa a deuda' },
	'credits.debt.absorbed': { level: 'warn', msg: 'Exceso de deuda absorbido por el administrador' },
	'credits.debt.settled': { level: 'info', msg: 'Deuda liquidada' },
	'credits.bucket.granted': { level: 'info', msg: 'Bolsa de saldo concedida' },
	'credits.welcome.denied': { level: 'info', msg: 'Bienvenida no concedida' },
	'credits.adjustment.applied': { level: 'info', msg: 'Ajuste manual aplicado' },
	'credits.adjustment.rejected': { level: 'info', msg: 'Ajuste manual rechazado' },
	'credits.expiry.applied': { level: 'info', msg: 'Caducidad de saldo aplicada' },
	'credits.expiry.warned': { level: 'info', msg: 'Avisos de caducidad enviados' },
	'credits.balance.forfeited': { level: 'info', msg: 'Saldo anulado por el borrado de la cuenta' },
	'credits.ledger.mismatch': { level: 'error', msg: 'Discrepancia entre saldo y ledger' },
	'credits.refund.applied': {
		level: 'info',
		msg: 'Reembolso aplicado sobre la bolsa de la compra'
	},
	'credits.low_balance.crossed': { level: 'info', msg: 'Saldo cruza el umbral de aviso' },
	'credits.chargeback.applied': {
		level: 'warn',
		msg: 'Contracargo aplicado: saldo retirado y deuda sin tope'
	}
} as const satisfies Record<keyof CreditsLogFields, LogEventMeta>);
