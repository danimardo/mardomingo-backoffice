// Doble de facturación para las pruebas (T231): numeración correlativa por serie, como la del proveedor real. La serie es
// la de la fecha de emisión del año: aquí se fija en 'A' para simplificar las pruebas.
import type { InvoicingProvider, IssueInput, IssueOutcome } from './provider';

export interface FakeInvoicingProvider extends InvoicingProvider {
	/** Cuántas facturas ha emitido, para comprobar que la emisión no se repite. */
	issuedCount(): number;
}

/** PDF mínimo de prueba: no es una factura válida; solo sirve para probar la descarga (solo con `INVOICING_PROVIDER=fake`). */
const FAKE_PDF = [
	'%PDF-1.4',
	'1 0 obj << /Type /Catalog >> endobj',
	'% PDF de prueba {ref}',
	'%%EOF',
	''
].join('\n');

export function createFakeInvoicing(series = 'A'): FakeInvoicingProvider {
	let counter = 0;
	const issue = (input: IssueInput): IssueOutcome => {
		counter += 1;
		const number = String(counter).padStart(6, '0');
		return {
			ok: true,
			invoice: { series, number, providerRef: `fake_${series}${number}_${input.issueKey}` }
		};
	};
	return {
		name: 'fake',
		issuedCount: () => counter,
		issueInvoice: issue,
		issueCorrective: (input) => issue(input),
		getPdf: (providerRef) => ({ ok: true, pdfRef: `pdf/${providerRef}.pdf` }),
		readPdf: (pdfRef) => new TextEncoder().encode(FAKE_PDF.replace('{ref}', pdfRef))
	};
}
