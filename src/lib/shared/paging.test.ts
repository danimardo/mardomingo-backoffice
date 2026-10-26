// Paginación de las listas de administración (UX-09): la página pedida, la siguiente detectada y los límites.
import { describe, expect, it } from 'vitest';
import { ADMIN_PAGE_SIZE, fetchLimit, pageNumber, sliceOf } from './paging';

describe('paginación de las listas de administración (UX-09)', () => {
	it('la página pedida es un entero mayor o igual que 1', () => {
		expect(pageNumber(null)).toBe(1);
		expect(pageNumber('3')).toBe(3);
		expect(pageNumber('abc')).toBe(1);
		expect(pageNumber('0')).toBe(1);
	});

	it('pide una fila más de la página para detectar la siguiente', () => {
		expect(fetchLimit(1)).toBe(ADMIN_PAGE_SIZE + 1);
		expect(fetchLimit(2)).toBe(2 * ADMIN_PAGE_SIZE + 1);
	});

	it('corta la página, y dice si hay anterior y siguiente', () => {
		const rows = Array.from({ length: ADMIN_PAGE_SIZE + 1 }, (_, index) => index);

		expect(sliceOf(rows, 1)).toEqual({
			items: rows.slice(0, ADMIN_PAGE_SIZE),
			page: 1,
			hasPrevious: false,
			hasNext: true
		});
		expect(sliceOf(rows, 2)).toEqual({
			items: [ADMIN_PAGE_SIZE],
			page: 2,
			hasPrevious: true,
			hasNext: false
		});
	});
});
