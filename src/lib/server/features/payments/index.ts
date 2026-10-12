// API pública de `payments` (ARCHITECTURE.md §4). Las rutas solo importan este fichero. Las aristas permitidas son
// `apps`, `audit`, `credits`, `invoicing`, `accounts` y `legal`: `payments` no escribe en sus tablas.
export { seedPayments } from './seed';
export {
	createPaymentsService,
	type PaymentsDeps,
	type PaymentsService,
	type PurchaseInput,
	type PurchaseOutcome,
	type PurchaseView,
	type RefundOutcome,
	type SalePack
} from './service';
export { PAYMENTS_LOG_EVENTS, type PaymentsLogFields } from './events';
