/**
 * Tipos compartidos por Fase 4 (§16-20, §69 Fase 4): `DataTable`,
 * `StructuredList`, `DataCard` y el orquestador `AdaptiveDataView`
 * comparten la MISMA forma de columna/orden/selección/acción para que
 * cambiar de una representación a otra (móvil→tablet→escritorio) no
 * signifique remapear el dataset tres veces. Mismo criterio que
 * `buttons/types.ts`/`forms/types.ts`: un solo sitio para lo que se
 * repite entre piezas hermanas.
 *
 * Genéricos, no un `id: string` asumido en el tipo de fila: cada pieza
 * que necesita identificar una fila (selección, expansión) recibe un
 * `rowKey: (row: T) => string` — el dataset del consumidor puede usar
 * `id`, `uuid`, `slug`... sin que este paquete le imponga un nombre de
 * campo.
 */

import type { Snippet } from "svelte";

export type SortDirection = "asc" | "desc";

export interface SortState {
	key: string;
	direction: SortDirection;
}

/** Identifica una fila para selección/expansión — ver nota de arriba. */
export type RowKey<T> = (row: T) => string;

export interface DataColumn<T> {
	/** Debe coincidir con la `key` que usan `SortState`/`onSort`. */
	key: string;
	label: string;
	sortable?: boolean;
	align?: "start" | "center" | "end";
	/** Track de CSS Grid (`"1fr"`, `"10rem"`, `"minmax(8rem,1fr)"`...) — estructural, no un token de diseño (igual que `minColumnWidth` de `Grid` en Fase 1). Ancho inicial; si el usuario redimensiona la columna (ver `resizable`), el ancho que arrastre sustituye a este valor. */
	width?: string;
	/** Solo tiene efecto en `DataTable` (nivel Desktop de `AdaptiveDataView`) — arrastrar el borde derecho de la cabecera, o Flecha-izq/Flecha-der con el tirador enfocado, cambia el ancho de columna. El ancho mínimo lo impone CSS (`--space-16`), no un límite calculado a mano. */
	resizable?: boolean;
	/** Si no se da, la celda cae a `String(row[key])`. */
	cell?: Snippet<[T]>;
}

export interface DataAction<T> {
	label: string;
	icon?: Snippet;
	danger?: boolean;
	disabled?: (row: T) => boolean;
	onclick: (row: T) => void;
}

/**
 * Siguiente paso de orden dado el estado actual y la columna en la que
 * se acaba de pulsar — ciclo asc → desc → sin orden (null), el mismo
 * ciclo de tres pasos que usan la mayoría de tablas (GitHub, Notion...).
 */
export function nextSortState(current: SortState | null, key: string): SortState | null {
	if (!current || current.key !== key) return { key, direction: "asc" };
	if (current.direction === "asc") return { key, direction: "desc" };
	return null;
}

/** Comparador genérico por defecto — usado cuando la columna no trae su propio `compare`. */
export function defaultCompare(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return -1;
	if (b == null) return 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b));
}
