// Interfaz del proveedor de facturación (BE-FR-75, FR-045; T231). La numeración la asigna el proveedor, por serie y de forma
// correlativa. En la v4 la implementación en uso es `none`, que no emite: la facturación real queda para la fase posterior.

export interface IssueInput {
	readonly issueKey: string;
	readonly amountEurCents: number;
	readonly billingSnapshot: Readonly<Record<string, unknown>> | null;
}

export interface IssuedInvoice {
	readonly series: string;
	readonly number: string;
	readonly providerRef: string;
}

export type IssueOutcome =
	| { readonly ok: true; readonly invoice: IssuedInvoice }
	| { readonly ok: false; readonly reason: 'not_issued' };

export interface InvoicingProvider {
	readonly name: 'none' | 'fake';
	issueInvoice(input: IssueInput): IssueOutcome;
	issueCorrective(input: IssueInput & { readonly correctsNumber: string }): IssueOutcome;
	getPdf(
		providerRef: string
	):
		| { readonly ok: true; readonly pdfRef: string }
		| { readonly ok: false; readonly reason: 'not_available' };
}
