/**
 * trayMenu.ts (§60.7, "Tray" en §69) — envuelve `@tauri-apps/api/tray` +
 * `@tauri-apps/api/menu`: crear el icono de bandeja del sistema y su
 * menú contextual. Del catálogo de 60.7 (`TrayMenu`/`TrayMenuItem`/
 * `TrayStatus`/`TrayNotification`/`MinimizeToTrayAction`) ninguna pieza
 * es presentacional: un icono de bandeja y su menú los dibuja el propio
 * SO, no el WebView — ni siquiera existe un "componente Svelte de
 * bandeja" posible, así que toda "Tray" de §69 es este módulo utilitario,
 * sin ningún `.svelte` (mismo motivo que `dialogBridge.ts` no tiene
 * componente para el diálogo nativo en sí). `TrayMenuItem` es la forma
 * de dato que ya existe (`DesktopMenuItem`, `tauri/types.ts`) — se
 * reutiliza en vez de duplicarla; `TrayStatus`/`TrayNotification` son
 * `setTooltip`/`setIcon` con distintos argumentos, ya cubiertos por
 * `updateTray`; `MinimizeToTrayAction` es lógica de la app consumidora
 * (ocultar la ventana en el evento `close` y usar el propio tray para
 * volver a mostrarla), no una función de esta librería.
 *
 * Ver `tauriEnv.ts`: import estático normal, todo el IPC real vive aquí.
 */
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { isTauri } from "./tauriEnv.js";
import type { DesktopMenuItem } from "./types.js";

/** Construye un `Menu` nativo a partir de la misma forma de dato que usa `DesktopMenuBar`. */
async function buildMenu(items: DesktopMenuItem[]) {
	return Menu.new({
		items: items.map((item) => ({
			id: item.id,
			text: item.label,
			enabled: !item.disabled,
			action: item.onselect
		}))
	});
}

export interface TrayOptions {
	tooltip?: string;
	items: DesktopMenuItem[];
}

/** Crea el icono de bandeja del sistema con su menú contextual. `null` fuera de Tauri. */
export async function createTrayMenu(options: TrayOptions): Promise<TrayIcon | null> {
	if (!isTauri()) return null;
	const menu = await buildMenu(options.items);
	return TrayIcon.new({
			menu,
			...(options.tooltip !== undefined && { tooltip: options.tooltip }),
			showMenuOnLeftClick: true
		});
}

/** Actualiza el tooltip y/o el menú de un icono de bandeja ya creado. */
export async function updateTray(tray: TrayIcon, updates: { tooltip?: string; items?: DesktopMenuItem[] }): Promise<void> {
	if (updates.tooltip !== undefined) await tray.setTooltip(updates.tooltip);
	if (updates.items) await tray.setMenu(await buildMenu(updates.items));
}

/** Libera el recurso del icono de bandeja (lo quita del sistema). */
export async function closeTray(tray: TrayIcon): Promise<void> {
	await tray.close();
}
