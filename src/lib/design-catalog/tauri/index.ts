/**
 * Barrel de la capa Tauri (Fase 7, §60/§69). Ver `tauriEnv.ts` para la
 * arquitectura completa (por qué los componentes `.svelte` no importan
 * `@tauri-apps/*` y los módulos utilitarios sí, con imports estáticos
 * normales).
 */
export { isTauri } from "./tauriEnv.js";

export { default as AppTitleBar } from "./AppTitleBar.svelte";
export { default as WindowControls } from "./WindowControls.svelte";
export { default as DesktopMenuBar } from "./DesktopMenuBar.svelte";
export { default as DesktopToolbar } from "./DesktopToolbar.svelte";
export { default as StatusBar } from "./StatusBar.svelte";
export { default as UpdatePrompt } from "./UpdatePrompt.svelte";
export { default as WindowSwitcher } from "./WindowSwitcher.svelte";
export { default as StatusIsland } from "./StatusIsland.svelte";

export type { DesktopMenu, DesktopMenuItem, ToolbarSection, ToolbarItem, StatusBarItem, StatusIndicatorTone } from "./types.js";

export { openFileDialog, openFolderDialog, saveFileDialog, showMessageDialog, confirmDialog } from "./dialogBridge.js";
export type { FileDialogOptions } from "./dialogBridge.js";

export { checkForUpdate, downloadAndInstallUpdate, closeUpdate } from "./updateBridge.js";
export type { UpdateInfo } from "./updateBridge.js";

export { openWindow, listWindows, focusWindow, currentWindowLabel } from "./windowManager.js";
export type { WindowSummary } from "./windowManager.js";

export { createTrayMenu, updateTray, closeTray } from "./trayMenu.js";
export type { TrayOptions } from "./trayMenu.js";
