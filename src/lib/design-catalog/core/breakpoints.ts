/**
 * breakpoints.ts — ronda de ampliación UX post-v0.14.0 (ver docs/ROADMAP.md).
 * Puente entre `--breakpoint-container-*` de tokens.css (números CSS) y
 * el código de componente que necesita compararlos contra un ancho de
 * `ResizeObserver` en JavaScript (`AdaptiveDataView`, `ResponsiveActions`).
 *
 * Igual que `motion/tokens.ts` con `DURATION_MS`/`EASING`: esto es un
 * ESPEJO deliberado de tokens.css, no una lectura en vivo
 * (`getComputedStyle`) — los breakpoints de contenedor son píxeles
 * absolutos, invariantes por tema, así que espejarlos es seguro y evita
 * depender de `document` en un módulo que también se usa en el cuerpo de
 * un componente antes del primer render. Si tokens.css cambia estos
 * valores, este fichero hay que actualizarlo a mano.
 */

/** Espejo de --breakpoint-container-sm/md/lg/xl (tokens.css). */
export const BREAKPOINT_CONTAINER_PX = {
	sm: 480,
	md: 640,
	lg: 720,
	xl: 960
} as const;

export type BreakpointContainerToken = keyof typeof BREAKPOINT_CONTAINER_PX;
