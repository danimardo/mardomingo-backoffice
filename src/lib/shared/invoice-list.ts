// Filtro, orden y página del listado de facturas del panel (BE-FR-75; UX-09). Son funciones puras: la ruta las usa y las
// pruebas las comprueban sin base de datos. El tamaño de página es de 20 facturas.

export const INVOICES_PAGE_SIZE = 20;
export const INVOICE_KINDS = Object.freeze(['full', 'simplified', 'corrective'] as const);
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export type InvoiceOrder = 'asc' | 'desc';

/** Tipo de factura del filtro, o `null` si es «todos» o el valor no existe. */
export function kindParam(value: string | null): InvoiceKind | null {
	return INVOICE_KINDS.find((kind) => kind === value) ?? null;
}

/** Orden por fecha: «asc» solo si se pide explícitamente; por defecto, las más recientes primero. */
export function orderParam(value: string | null): InvoiceOrder {
	return value === 'asc' ? 'asc' : 'desc';
}

/** Página pedida, como entero mayor o igual que 1. */
export function pageParam(value: string | null): number {
	return Math.max(1, Number.parseInt(value ?? '1', 10) || 1);
}

/** Filtra por tipo y ordena por fecha de emisión sin modificar la lista original. */
export function selectInvoices<T extends { readonly kind: string; readonly issuedAt: number }>(
	invoices: readonly T[],
	kind: InvoiceKind | null,
	order: InvoiceOrder
): T[] {
	return invoices
		.filter((invoice) => kind === null || invoice.kind === kind)
		.sort((a, b) => (order === 'asc' ? a.issuedAt - b.issuedAt : b.issuedAt - a.issuedAt));
}

/** Número de páginas (al menos 1) y la página efectiva, que nunca pasa del total. */
export function pageOf(
	total: number,
	requested: number
): { readonly page: number; readonly pages: number; readonly start: number } {
	const pages = Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE));
	const page = Math.min(requested, pages);
	return { page, pages, start: (page - 1) * INVOICES_PAGE_SIZE };
}
