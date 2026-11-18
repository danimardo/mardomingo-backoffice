/**
 * dialogBridge.ts (§60.5, "Dialog bridge" en §69) — envuelve
 * `@tauri-apps/plugin-dialog` (diálogos NATIVOS del sistema operativo:
 * abrir/guardar archivo, carpeta, mensaje, confirmación). Del catálogo de
 * 60.5 (`DesktopDialog`/`FileOpenDialog`/`FileSaveDialog`/`FolderPicker`/
 * `ConfirmationWindow`/`AboutWindow`/`PreferencesWindow`) solo
 * "Dialog bridge" está en la lista curada de §69: un diálogo NATIVO no es
 * un componente Svelte que este paquete pueda dibujar (lo pinta el propio
 * SO, no el WebView) — así que aquí no hay ninguna pieza visual, solo
 * funciones que lo abren. `AboutWindow`/`PreferencesWindow` (60.5) SÍ
 * serían contenido propio en una `Modal`/`Dialog` de Fase 5, ya
 * cubiertas por esas piezas — no una nueva.
 *
 * Ver la nota de arquitectura en `tauriEnv.ts`: import ESTÁTICO normal de
 * `@tauri-apps/plugin-dialog` (resuelve porque el paquete SÍ está
 * instalado — `devDependency` aquí, `peerDependency` opcional para quien
 * consuma el paquete; ya no hace falta `import()` dinámico ni ningún
 * truco de resolución, ver `tauriEnv.ts`). Cada función comprueba
 * `isTauri()` y, fuera de Tauri, se resuelve a un valor "vacío" en vez de
 * intentar la llamada IPC real (que fallaría sin un runtime Tauri) — así
 * el mismo código de consumidor puede llamarse en web/PWA sin romperse,
 * degradando a "no hay diálogo nativo disponible" en vez de lanzar.
 */
import { open, save, message, confirm } from "@tauri-apps/plugin-dialog";
import type { DialogFilter, MessageDialogOptions, ConfirmDialogOptions } from "@tauri-apps/plugin-dialog";
import { isTauri } from "./tauriEnv.js";

export interface FileDialogOptions {
	title?: string;
	filters?: DialogFilter[];
	defaultPath?: string;
	multiple?: boolean;
}

/** Diálogo nativo "Abrir archivo". `null`/`[]` fuera de Tauri o si el usuario cancela. */
export async function openFileDialog(options: FileDialogOptions = {}): Promise<string | string[] | null> {
	if (!isTauri()) return options.multiple ? [] : null;
	return open(options);
}

/** Diálogo nativo "Elegir carpeta". */
export async function openFolderDialog(options: Omit<FileDialogOptions, "filters"> = {}): Promise<string | string[] | null> {
	if (!isTauri()) return options.multiple ? [] : null;
	return open({ ...options, directory: true });
}

/** Diálogo nativo "Guardar como". */
export async function saveFileDialog(options: FileDialogOptions = {}): Promise<string | null> {
	if (!isTauri()) return null;
	return save(options);
}

/** Diálogo nativo de mensaje (informativo, un solo botón). */
export async function showMessageDialog(text: string, options?: string | MessageDialogOptions): Promise<void> {
	if (!isTauri()) return;
	await message(text, options);
}

/** Diálogo nativo de confirmación (Sí/No). `false` fuera de Tauri. */
export async function confirmDialog(text: string, options?: string | ConfirmDialogOptions): Promise<boolean> {
	if (!isTauri()) return false;
	return confirm(text, options);
}
