// Filtro, orden y página del listado de facturas (UX-09): los valores raros no rompen la lista.
import { describe, expect, it } from 'vitest';
import {
	INVOICES_PAGE_SIZE,
	kindParam,
	orderParam,
	pageOf,
	pageParam,
	selectInvoices
} from './invoice-list';

const invoices = [
	{ kind: 'full', issuedAt: 3 },
	{ kind: 'simplified', issuedAt: 1 },
	{ kind: 'corrective', issuedAt: 2 }
];

describe('listado de facturas (UX-09)', () => {
	it('el tipo desconocido se trata como «todos» y el orden por defecto es el más reciente', () => {
		expect(kindParam('inventado')).toBeNull();
		expect(kindParam(null)).toBeNull();
		expect(kindParam('full')).toBe('full');
		expect(orderParam(null)).toBe('desc');
		expect(orderParam('asc')).toBe('asc');
	});

	it('filtra por tipo y ordena por fecha sin tocar la lista original', () => {
		const copy = [...invoices];

		expect(selectInvoices(invoices, 'full', 'desc').map((i) => i.issuedAt)).toEqual([3]);
		expect(selectInvoices(invoices, null, 'asc').map((i) => i.issuedAt)).toEqual([1, 2, 3]);
		expect(selectInvoices(invoices, null, 'desc').map((i) => i.issuedAt)).toEqual([3, 2, 1]);
		expect(invoices).toEqual(copy);
	});

	it('la página pedida nunca pasa del total y la lista vacía tiene una página', () => {
		expect(pageParam(null)).toBe(1);
		expect(pageParam('2')).toBe(2);
		expect(pageParam('abc')).toBe(1);
		expect(pageParam('0')).toBe(1);
		expect(pageOf(0, 5)).toEqual({ page: 1, pages: 1, start: 0 });
		expect(pageOf(INVOICES_PAGE_SIZE * 2 + 1, 9)).toEqual({
			page: 3,
			pages: 3,
			start: INVOICES_PAGE_SIZE * 2
		});
	});
});
