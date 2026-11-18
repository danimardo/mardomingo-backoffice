/**
 * updateBridge.ts (§60.9, "Update UI" en §69) — envuelve
 * `@tauri-apps/plugin-updater`: comprobar/descargar/instalar una
 * actualización. Ver la nota de arquitectura en `tauriEnv.ts` — import
 * estático normal (el paquete está instalado), y aquí es donde vive TODA
 * la llamada IPC real; `UpdatePrompt.svelte` (el componente renderizable)
 * no importa este módulo ni `@tauri-apps/*` en absoluto — el consumidor
 * llama a `checkForUpdate()`/`downloadAndInstallUpdate()` y pasa lo que
 * devuelven como props/callbacks a `UpdatePrompt`.
 *
 * `UpdateInfo` es una versión reducida y serializable de la clase
 * `Update` del plugin (que mantiene un recurso vivo en el lado de Rust,
 * `rid`/`close()`) — el componente presentacional solo necesita
 * `version`/`body`/`date`, no el recurso completo; por eso
 * `checkForUpdate` devuelve un `UpdateInfo` de solo datos y guarda el
 * `Update` real en un mapa interno, recuperado por
 * `downloadAndInstallUpdate`/`closeUpdate` a partir del mismo objeto.
 */
import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { isTauri } from "./tauriEnv.js";

export interface UpdateInfo {
	version: string;
	currentVersion: string;
	date?: string | undefined;
	body?: string | undefined;
}

const pendingUpdates = new WeakMap<UpdateInfo, Update>();

/** Comprueba si hay una actualización disponible. `null` fuera de Tauri o si ya está al día. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
	if (!isTauri()) return null;
	const update = await check();
	if (!update) return null;
	const info: UpdateInfo = {
		version: update.version,
		currentVersion: update.currentVersion,
		date: update.date,
		body: update.body
	};
	pendingUpdates.set(info, update);
	return info;
}

/**
 * Descarga e instala la actualización devuelta por `checkForUpdate`.
 * `onProgress` recibe la fracción descargada (0-1) cuando el servidor
 * informa del tamaño total; si no lo informa, recibe `null` en cada
 * evento de progreso (progreso indeterminado).
 */
export async function downloadAndInstallUpdate(info: UpdateInfo, onProgress?: (fraction: number | null) => void): Promise<void> {
	const update = pendingUpdates.get(info);
	if (!update) return;

	let totalBytes = 0;
	let downloadedBytes = 0;

	await update.downloadAndInstall((event: DownloadEvent) => {
		if (event.event === "Started") {
			totalBytes = event.data.contentLength ?? 0;
		} else if (event.event === "Progress") {
			downloadedBytes += event.data.chunkLength;
			onProgress?.(totalBytes > 0 ? Math.min(1, downloadedBytes / totalBytes) : null);
		} else if (event.event === "Finished") {
			onProgress?.(1);
		}
	});
}

/** Libera el recurso de la actualización sin instalarla (el usuario la descartó). */
export async function closeUpdate(info: UpdateInfo): Promise<void> {
	const update = pendingUpdates.get(info);
	if (!update) return;
	await update.close();
	pendingUpdates.delete(info);
}
