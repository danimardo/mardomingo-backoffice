/**
 * Núcleo compartido, sin framework (v1.12.0). Aquí vive lo que no depende de Svelte, de Blade ni de React:
 * helpers de fechas, rejilla de breakpoints, trampa de foco. Svelte (`src/lib/`), Blade (`laravel/`) y, más adelante,
 * React (`react/`) lo consumen. `scripts/verify-core.mjs` impide que importe nada de un framework.
 */
export * from "./breakpoints.js";
export * from "./focusTrap.js";
export * from "./dateUtils.js";
