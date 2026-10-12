// API pública de `invoicing` (ARCHITECTURE.md §4). `payments` la usa para emitir y rectificar; las rutas solo importan este
// fichero. En la v4 el proveedor en uso es `none`, que no emite (BE-FR-75).
export {
	correctPayment,
	createInvoicingService,
	issueCorrective,
	issueForPayment,
	saveBillingProfile,
	type CorrectPaymentInput,
	type InvoicingDeps,
	type InvoicingService,
	type IssueCorrectiveInput,
	type IssueForPaymentInput,
	type IssueOutcome,
	type SaveProfileOutcome
} from './service';
export { billingProfileOf } from './repository';
export { INVOICING_LOG_EVENTS, type InvoicingLogFields } from './events';
