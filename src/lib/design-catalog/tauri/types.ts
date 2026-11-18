/**
 * Tipos compartidos por la capa Tauri (Fase 7, §60/§69). Centralizados
 * aquí por el mismo motivo que `patterns/types.ts` en Fase 6: varios
 * componentes comparten la misma forma de dato (`DesktopMenuItem` lo usan
 * `DesktopMenuBar` y, indirectamente, cualquier consumidor que construya
 * un menú nativo real con `menu.ts`).
 */

/** Un item de `DesktopMenuBar`/`DesktopMenu` — puramente presentacional. */
export interface DesktopMenuItem {
	id: string;
	label: string;
	/** Texto de atajo a mostrar (p.ej. "Ctrl+N") — solo visual, no registra el atajo. */
	shortcut?: string;
	disabled?: boolean;
	/** Separador visual DESPUÉS de este item. */
	separatorAfter?: boolean;
	onselect?: () => void;
}

/** Un menú de nivel superior de `DesktopMenuBar` (p.ej. "Archivo"). */
export interface DesktopMenu {
	id: string;
	label: string;
	items: DesktopMenuItem[];
}

/** Un item de `DesktopToolbar`. */
export interface ToolbarItem {
	id: string;
	label: string;
	icon: import("svelte").Snippet;
	disabled?: boolean;
	/** Estado "presionado" para un toggle (p.ej. mostrar/ocultar un panel). */
	active?: boolean;
	onclick?: () => void;
}

/** Un grupo de `ToolbarItem` dentro de `DesktopToolbar`, separado visualmente de los demás. */
export interface ToolbarSection {
	id: string;
	items: ToolbarItem[];
}

export type StatusIndicatorTone = "neutral" | "success" | "warning" | "danger" | "info";

/** Un segmento de `StatusBar` (p.ej. estado de conexión, progreso, mensaje). */
export interface StatusBarItem {
	id: string;
	label: string;
	tone?: StatusIndicatorTone;
	/** Punto de color antes de la etiqueta (indicador de estado tipo "conectado"). */
	dot?: boolean;
}
