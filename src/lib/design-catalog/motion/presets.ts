/**
 * presets.ts (§61, Fase 8) — transiciones de `svelte/transition`
 * PRECONFIGURADAS con los tokens de motion (`tokens.ts`) y con
 * `prefers-reduced-motion` resuelto una sola vez aquí, no en cada sitio
 * que anime algo. No reimplementa el motor de animación de Svelte — lo
 * envuelve, mismo criterio que el resto del paquete evita reinventar lo
 * que la plataforma/el framework ya resuelven bien (`Checkbox`/`Radio`
 * sobre `<input>` nativo en Fase 2, `DataTable` sobre `<table>` nativo en
 * Fase 4).
 *
 * Alcance frente al catálogo completo de §61 (13 piezas) — decisión
 * documentada también en `docs/ROADMAP.md`:
 *
 * - **Fade/Scale/Slide** → `fadeToken`/`scaleToken`/`slideToken` (aquí).
 * - **GlassTransition** → `glassTransitionToken` (aquí): fundido + escala
 *   + blur, pensado para que un `GlassSurface`/`GlassPanel` aparezca como
 *   si "se condensara" en vez de solo aparecer.
 * - **CrossFade / SharedLayoutTransition** → `crossfadeTokens()` (aquí):
 *   un envoltorio de `crossfade()` de `svelte/transition` con los
 *   tokens de motion por defecto — `crossfade` YA ES el mecanismo nativo
 *   de Svelte para transiciones de "elemento compartido" (se enlazan dos
 *   nodos por `key`), así que no hace falta una pieza nueva encima,
 *   solo tokenizar sus valores por defecto.
 * - **ExpandCollapse** → componente propio, ver `ExpandCollapse.svelte`.
 * - **HoverLift / PressFeedback** → acciones (`use:`), ver `actions.ts`.
 * - **SpringMotion** → NO se envuelve: `svelte/motion` ya exporta
 *   `spring`/`tweened` directamente, con el `--easing-spring` de este
 *   paquete como el `Record<string, EasingFunction>` que ya exporta
 *   `tokens.ts` — envolverlos aquí sería re-exportar la API de Svelte con
 *   otro nombre, no añadir nada.
 * - **Parallax** → fuera de alcance: depende del layout/scroll concreto
 *   de cada pantalla, no hay una forma genérica reutilizable sin un
 *   consumidor real que la acote (mismo motivo que dejó fuera
 *   `MenuCheckItem`/`MenuRadioItem` en Fase 7).
 * - **PageTransition** → fuera de alcance: exige un router, y este
 *   paquete es agnóstico de routing (no asume SvelteKit ni ningún otro).
 * - **Motion** → es el nombre genérico/paraguas del catálogo de §61, no
 *   una pieza en sí — cubierto por el conjunto de arriba.
 */
import { fade, fly, scale, slide, crossfade } from "svelte/transition";
import type { TransitionConfig } from "svelte/transition";
import { DURATION_MS, EASING, prefersReducedMotion } from "./tokens.js";
import type { DurationToken, EasingToken } from "./tokens.js";

export interface TokenTransitionParams {
	duration?: DurationToken;
	easing?: EasingToken;
	delay?: number;
}

function resolve(params: TokenTransitionParams): { duration: number; easing: (t: number) => number; delay: number } {
	const reduced = prefersReducedMotion();
	return {
		// 1ms en vez de 0: duration=0 hace que algunos navegadores salten el
		// callback de fin de transición de forma inconsistente — 1ms es
		// efectivamente instantáneo mientras sigue siendo una transición real.
		duration: reduced ? 1 : DURATION_MS[params.duration ?? "normal"],
		easing: EASING[params.easing ?? "standard"],
		delay: reduced ? 0 : (params.delay ?? 0)
	};
}

/** `transition:fadeToken` — fundido simple, tokenizado. */
export function fadeToken(node: Element, params: TokenTransitionParams = {}): TransitionConfig {
	return fade(node, resolve(params));
}

/** `transition:scaleToken` — escala + fundido, tokenizado (menús, popovers, tarjetas que aparecen). */
export function scaleToken(node: Element, params: TokenTransitionParams & { start?: number } = {}): TransitionConfig {
	return scale(node, { ...resolve(params), start: params.start ?? 0.95 });
}

/** `transition:slideToken` — colapso de alto, tokenizado (base de `ExpandCollapse`). */
export function slideToken(node: Element, params: TokenTransitionParams = {}): TransitionConfig {
	return slide(node, resolve(params));
}

/**
 * `transition:glassTransitionToken` — fundido + escala + blur creciente,
 * para que un elemento de cristal (`GlassSurface`/`GlassPanel`) parezca
 * "condensarse" al aparecer en vez de solo entrar en fundido. Compone
 * `scale` (de `svelte/transition`, con blur añadido vía `css`) en vez de
 * envolver `blur` de `svelte/transition` directamente porque ese `blur`
 * anima el desenfoque de TODO el contenido (ilegible mientras transiciona
 * texto) — aquí el `filter: blur()` se queda en un rango pequeño (0→4px)
 * pensado como acompañamiento de la escala, no como el efecto principal.
 */
export function glassTransitionToken(_node: Element, params: TokenTransitionParams & { start?: number } = {}): TransitionConfig {
	const { duration, easing, delay } = resolve(params);
	const start = params.start ?? 0.96;
	return {
		duration,
		easing,
		delay,
		css: (t: number) => {
			const eased = easing(t);
			const s = start + (1 - start) * eased;
			return `opacity:${eased};transform:scale(${s});filter:blur(${(1 - eased) * 4}px);`;
		}
	};
}

/**
 * `transition:flyToken` — entra/sale deslizando desde un borde + fundido,
 * tokenizado (nuevo en la ronda de ampliación post-v0.13.0, base de
 * `Drawer`/panel lateral — ningún componente anterior necesitaba una
 * entrada direccional, solo colapso de alto (`slideToken`) o
 * escala/fundido en el sitio (`scaleToken`), así que no existía todavía
 * un envoltorio tokenizado de `fly`). Mismos `x`/`y` en píxeles que
 * espera `fly` de `svelte/transition` — no son un token de diseño
 * (desplazamiento de animación, no una medida visual persistente), igual
 * criterio que el `width`/`minColumnWidth` estructural de `Grid`/
 * `DataColumn` en fases anteriores.
 */
export function flyToken(node: Element, params: TokenTransitionParams & { x?: number; y?: number } = {}): TransitionConfig {
	return fly(node, { ...resolve(params), x: params.x ?? 0, y: params.y ?? 0 });
}

/**
 * `crossfadeTokens()` — mismo `crossfade()` de `svelte/transition`, con
 * los tokens de motion como valores por defecto (`fallback` usa
 * `scaleToken` para el nodo que no tiene pareja, en vez del fundido por
 * defecto de Svelte). Uso idéntico al de la documentación de Svelte:
 * `const [send, receive] = crossfadeTokens();` y luego
 * `transition:send={{ key }}` / `transition:receive={{ key }}` en cada
 * lado de la pareja de nodos.
 */
export function crossfadeTokens(params: TokenTransitionParams = {}) {
	const base = resolve(params);
	return crossfade({
		duration: base.duration,
		easing: base.easing,
		fallback: (node) => scaleToken(node, params)
	});
}
