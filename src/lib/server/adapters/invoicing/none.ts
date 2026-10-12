// Facturación `none` (BE-FR-75 CA1; T231): en la v4 no emite nada. El servicio registra la omisión con `provider_none` y
// no crea factura.
import type { InvoicingProvider, IssueOutcome } from './provider';

export function createNoneInvoicing(): InvoicingProvider {
	const notIssued: IssueOutcome = { ok: false, reason: 'not_issued' };
	return {
		name: 'none',
		issueInvoice: () => notIssued,
		issueCorrective: () => notIssued,
		getPdf: () => ({ ok: false, reason: 'not_available' })
	};
}
