/**
 * tauriEnv.ts (§60) — detección de entorno y arquitectura de la capa
 * Tauri completa. Léase antes de tocar cualquier otro fichero de
 * `src/lib/tauri/`.
 *
 * ## Por qué esta capa importa `@tauri-apps/api`/`@tauri-apps/plugin-*` de forma NORMAL (import estático, no dinámico)
 *
 * Se investigó empíricamente (con un `vite build` mínimo, no de memoria)
 * si Vite/Rollup permite dejar un `import()` de un paquete NO instalado
 * dentro de una rama muerta en tiempo de ejecución (`if (isTauri()) { ... }`
 * con `isTauri()` devolviendo `false` en el navegador). Resultado: NO —
 * Rollup resuelve el especificador de forma ESTÁTICA en cuanto aparece
 * escrito como literal en el código fuente, sea `import` estático o
 * `import()` dinámico, y el build falla con
 * `[UNRESOLVED_ENTRY]`/`Rollup failed to resolve import` aunque la rama
 * nunca se ejecute. Solo se evita con `import(/* @vite-ignore *\/ variable)`
 * (especificador NO literal), que si acaba corriendo en un navegador sin
 * Tauri intentaría resolver un specifier "bare" que el navegador tampoco
 * sabe cargar — es decir, ese patrón solo sirve para diferir el error, no
 * para eliminarlo, y además renuncia al tipado.
 *
 * La solución real no es evitar que Vite vea el import: es que el import
 * SIEMPRE resuelva, porque el paquete SÍ está instalado — como
 * `devDependency` aquí (para que `svelte-check`/`vite build` de esta
 * propia guía de estilos tengan algo que resolver) y como
 * `peerDependency` opcional (`peerDependenciesMeta.optional: true`) para
 * quien consuma el paquete: cualquier app Tauri real que use estos
 * componentes YA tiene `@tauri-apps/api` instalado como su propia
 * dependencia — es un requisito de cualquier proyecto Tauri, no algo que
 * este design system le añada. Así los ficheros de esta carpeta pueden
 * usar imports estáticos normales, con tipado completo, exactamente como
 * los escribiría cualquier app Tauri.
 *
 * ## Por qué la guía de estilos (`styleguide/`) igualmente no llama a la API real
 *
 * Aunque el paquete SÍ resuelve en el build, no hay un runtime Tauri real
 * en este entorno (un navegador sin `window.__TAURI_INTERNALS__`) — las
 * llamadas IPC reales (`invoke`, `getCurrentWindow().minimize()`...)
 * fallarían o quedarían colgadas. Por eso:
 *   - Todo componente Svelte RENDERIZABLE (`AppTitleBar`, `WindowControls`,
 *     `DesktopMenuBar`, `DesktopToolbar`, `StatusBar`, `UpdatePrompt`,
 *     `WindowSwitcher`) es puramente presentacional: no importa
 *     `@tauri-apps/*` en absoluto, recibe callbacks (`onMinimize`,
 *     `onSelectWindow`...) como props — mismo criterio ya usado en
 *     `ToastStack`/`DataTable` (Fase 4-5): "el consumidor conecta el
 *     comportamiento, el componente no lo esconde".
 *   - Las llamadas reales a `@tauri-apps/*` viven SOLO en los módulos no
 *     visuales (`dialogBridge.ts`, `updateBridge.ts`, `windowManager.ts`,
 *     `trayMenu.ts`) — funciones puras que el consumidor importa y cablea
 *     él mismo a los callbacks de los componentes de arriba. La guía de
 *     estilos los tipa (a través de `svelte-check`, que cubre todo
 *     `src/**\/*.ts` del `tsconfig`) pero no los EJECUTA ni los importa
 *     desde ninguna sección de demostración — no hay forma honesta de
 *     verificar con Playwright una llamada IPC real sin un runtime Tauri,
 *     así que no se finge que se ha hecho. Ver la nota "Qué NO se puede
 *     verificar aquí" en `docs/ROADMAP.md` (Fase 7).
 *
 * `isTauri()` es la única función que SÍ tiene sentido llamar en
 * cualquier entorno (navegador normal incluido): es una comprobación de
 * `window`, no una llamada IPC.
 */

export function isTauri(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
