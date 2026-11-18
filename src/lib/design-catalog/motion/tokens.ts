/**
 * tokens.ts (§61, Fase 8) — puente entre `--duration-*`/`--easing-*` de
 * tokens.css (números/curvas CSS) y lo que `svelte/transition` espera en
 * JavaScript (un número en ms, una función `(t: number) => number`).
 *
 * Los valores de aquí son un ESPEJO deliberado de tokens.css, no una
 * lectura en vivo (`getComputedStyle`) — mismo criterio ya usado en
 * `buttons/types.ts` (`sizeSpec`/`variantSpec`), que también mantiene sus
 * propios valores en JS en vez de leerlos del DOM: motion, a diferencia
 * del color, NO cambia por tema (`--duration-*`/`--easing-*` son
 * invariantes claro/oscuro en tokens.css), así que espejarlos es seguro y
 * evita depender de `document`/`getComputedStyle` en un módulo que
 * también se usa fuera de un `$effect` (p. ej. en el propio cuerpo de un
 * componente, antes del primer render). Si `tokens.css` cambia estos
 * valores, este fichero hay que actualizarlo a mano — el comentario junto
 * a cada constante apunta a la línea equivalente.
 */

/** Espejo de --duration-fast/--duration-normal/--duration-slow (tokens.css). */
export const DURATION_MS = {
	fast: 120,
	normal: 180,
	slow: 240
} as const;

export type DurationToken = keyof typeof DURATION_MS;

export type EasingFunction = (t: number) => number;

/**
 * Resuelve una curva `cubic-bezier(x1,y1,x2,y2)` a una función de easing
 * `(t) => number` — aproximación estándar por bisección sobre el
 * parámetro `t` de la curva de Bézier cúbica (7 iteraciones, suficiente
 * precisión para una curva de UI; el mismo método que usan
 * `d3-ease`/`popmotion` para este caso).
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
	function bezierComponent(t: number, a: number, b: number): number {
		const c = 3 * a;
		const d = 3 * (b - a) - c;
		const e = 1 - c - d;
		return ((e * t + d) * t + c) * t;
	}
	function solveTForX(x: number): number {
		let t = x;
		for (let i = 0; i < 7; i++) {
			const currentX = bezierComponent(t, x1, x2) - x;
			const derivative = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
			if (Math.abs(derivative) < 1e-6) break;
			t -= currentX / derivative;
		}
		return Math.min(1, Math.max(0, t));
	}
	return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : bezierComponent(solveTForX(t), y1, y2));
}

/** Espejo de --easing-standard/--easing-emphasized/--easing-spring/--easing-decelerate/--easing-accelerate (tokens.css). */
export const EASING = {
	standard: cubicBezier(0.2, 0, 0, 1),
	emphasized: cubicBezier(0.3, 0, 0.1, 1),
	spring: cubicBezier(0.34, 1.56, 0.64, 1),
	decelerate: cubicBezier(0, 0, 0.2, 1),
	accelerate: cubicBezier(0.4, 0, 1, 1)
} satisfies Record<string, EasingFunction>;

export type EasingToken = keyof typeof EASING;

/**
 * `true` si el sistema pide `prefers-reduced-motion: reduce` — §61 exige
 * que toda animación de este catálogo lo respete. `false` fuera de un
 * navegador (SSR) en vez de lanzar, igual que `isTauri()` fuera de un
 * navegador.
 */
export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
