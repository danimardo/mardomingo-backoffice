/**
 * windowManager.ts (§60.6, "Multiple windows" en §69) — envuelve
 * `@tauri-apps/api/webviewWindow`: crear/listar/enfocar ventanas. Del
 * catálogo de 60.6 (`WindowManager`/`ChildWindow`/`UtilityWindow`/
 * `ModalWindow`/`WindowLauncher`/`WindowSwitcher`) esta capa cubre
 * `WindowManager` (funciones de gestión) — `ChildWindow`/`UtilityWindow`/
 * `ModalWindow` son la MISMA operación (`openWindow`) con distintas
 * `WindowOptions` (decoraciones, tamaño, `parent`), no piezas separadas;
 * `WindowLauncher` es cualquier botón que llame a `openWindow` (no una
 * pieza nueva, mismo criterio que "Dialog bridge" no dibuja el diálogo
 * nativo). `WindowSwitcher` SÍ es presentacional — ver ese componente.
 *
 * Ver `tauriEnv.ts`: import estático normal, todo el IPC real vive aquí,
 * no en ningún componente Svelte.
 */
import { WebviewWindow, getAllWebviewWindows, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { WebviewOptions } from "@tauri-apps/api/webview";
import type { WindowOptions } from "@tauri-apps/api/window";
import { isTauri } from "./tauriEnv.js";

export interface WindowSummary {
	label: string;
	title: string;
	focused: boolean;
}

/** Abre una nueva ventana (child/utility/modal según las `options` que se pasen). No hace nada fuera de Tauri. */
export async function openWindow(
	label: string,
	url: string,
	options?: Omit<WebviewOptions, "x" | "y" | "width" | "height"> & WindowOptions
): Promise<void> {
	if (!isTauri()) return;
	const win = new WebviewWindow(label, { url, ...options });
	await new Promise<void>((resolve, reject) => {
		win.once("tauri://created", () => resolve());
		win.once("tauri://error", (e) => reject(e));
	});
}

/** Lista todas las ventanas abiertas, con su etiqueta, título y si está enfocada. `[]` fuera de Tauri. */
export async function listWindows(): Promise<WindowSummary[]> {
	if (!isTauri()) return [];
	const windows = await getAllWebviewWindows();
	return Promise.all(
		windows.map(async (w) => ({
			label: w.label,
			title: await w.title(),
			focused: await w.isFocused()
		}))
	);
}

/** Trae al frente y enfoca la ventana indicada por su `label`. */
export async function focusWindow(label: string): Promise<void> {
	if (!isTauri()) return;
	const win = await WebviewWindow.getByLabel(label);
	await win?.setFocus();
}

/** La etiqueta de la ventana desde la que se llama. `null` fuera de Tauri. */
export function currentWindowLabel(): string | null {
	if (!isTauri()) return null;
	return getCurrentWebviewWindow().label;
}
