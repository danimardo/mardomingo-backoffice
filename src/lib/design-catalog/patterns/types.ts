/**
 * Tipos compartidos por Fase 6 (§9, §49-55, §69 Fase 6): "Application
 * patterns" — no piezas nuevas de UI atómica, sino COMPOSICIONES de todo
 * lo construido en Fases 1-5. Mismo criterio que `data/types.ts`: un solo
 * sitio para la forma que comparten varias piezas hermanas.
 */

import type { Snippet } from "svelte";

/**
 * Una acción degradable de `ResponsiveActions` (§54) — y, por extensión,
 * de `PageHeader`/`ListPage`/`DetailPage`/`CRUDPage`, que la reciben tal
 * cual y se la pasan a `ResponsiveActions` por dentro. El ORDEN del array
 * es la prioridad: la primera es la que sobrevive más tiempo al
 * estrechar el contenedor (ver `ResponsiveActions.svelte`).
 */
export interface ResponsiveActionItem {
	label: string;
	icon?: Snippet;
	onclick: () => void;
	danger?: boolean;
	disabled?: boolean;
}

/** Un filtro activo mostrado como chip descartable en `FilterBar` (§30). */
export interface FilterBarChip {
	key: string;
	label: string;
	onRemove: () => void;
}

/**
 * Modo de `CRUDPage` (§50) — qué "pantalla" está visible. `"create"` y
 * `"edit"` comparten el slot `form` (mismo formulario, con `row: null` en
 * creación); se mantienen como valores distintos porque el título/breadcrumb
 * de cabecera SÍ difieren ("Nuevo servidor" vs "Editar core-switch-01").
 */
export type CRUDMode = "list" | "detail" | "create" | "edit";
