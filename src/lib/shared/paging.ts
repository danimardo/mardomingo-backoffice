// Paginación de las listas de administración (UX-09): página de 20 en 20 sobre una lista ya obtenida. Para saber si hay
// página siguiente se pide una fila más (`fetchLimit`), así no hace falta contar toda la tabla.

export const ADMIN_PAGE_SIZE = 20;

/** Página pedida como entero mayor o igual que 1. */
export function pageNumber(value: string | null): number {
	return Math.max(1, Number.parseInt(value ?? '1', 10) || 1);
}

/** Filas a pedir para mostrar la página: la página completa más una, para detectar la siguiente. */
export function fetchLimit(page: number): number {
	return page * ADMIN_PAGE_SIZE + 1;
}

/** Trozo de la lista que corresponde a la página, con sus enlaces de anterior y siguiente. */
export function sliceOf<T>(
	rows: readonly T[],
	page: number
): {
	readonly items: T[];
	readonly page: number;
	readonly hasPrevious: boolean;
	readonly hasNext: boolean;
} {
	const start = (page - 1) * ADMIN_PAGE_SIZE;
	return {
		items: rows.slice(start, start + ADMIN_PAGE_SIZE),
		page,
		hasPrevious: page > 1,
		hasNext: rows.length > page * ADMIN_PAGE_SIZE
	};
}
