/**
 * actions.ts (§61, Fase 8) — `HoverLift`/`PressFeedback` como acciones de
 * Svelte (`use:`), no componentes: son un COMPORTAMIENTO que se añade a
 * cualquier elemento existente (una `Card`, un botón a medida, una fila),
 * no algo que se renderiza — una acción es la forma correcta de Svelte
 * para eso, no un wrapper `<HoverLift><Card>...</Card></HoverLift>` que
 * obligaría a un `<div>` extra en el DOM solo para colgar un listener.
 *
 * Ambas respetan `prefers-reduced-motion` (sin transform ni transición
 * cuando está activo — el elemento sigue siendo interactivo, solo deja de
 * moverse) y limpian sus listeners en `destroy()`.
 *
 * A diferencia de `presets.ts` (que necesita una función JS de easing
 * para `svelte/transition`, de ahí `EASING` en `tokens.ts`), aquí el
 * `transition` es CSS puro — `var(--easing-standard)` funciona
 * directamente como `transition-timing-function`, sin pasar por la
 * versión JS espejada. Solo la DURACIÓN se toma de `DURATION_MS`
 * (`tokens.ts`) porque hace falta como número para el `ms` del string.
 */
import { spaceVar } from "../primitives/types.js";
import type { SpaceToken } from "../primitives/types.js";
import { DURATION_MS, prefersReducedMotion } from "./tokens.js";

export interface HoverLiftOptions {
	/** Distancia de elevación, en la escala de espaciado (§8). */
	distance?: SpaceToken;
}

/** `use:hoverLift` — eleva el elemento (translateY negativo) al pasar el ratón. */
export function hoverLift(node: HTMLElement, options: HoverLiftOptions = {}) {
	let distance = options.distance ?? 1;

	function apply() {
		if (prefersReducedMotion()) {
			node.style.transition = "";
			node.style.transform = "";
			return;
		}
		node.style.transition = `transform ${DURATION_MS.fast}ms var(--easing-standard, ease-out)`;
		node.style.willChange = "transform";
	}

	function onEnter() {
		if (prefersReducedMotion()) return;
		node.style.transform = `translateY(calc(${spaceVar(distance)} * -1))`;
	}

	function onLeave() {
		node.style.transform = "";
	}

	apply();
	node.addEventListener("mouseenter", onEnter);
	node.addEventListener("mouseleave", onLeave);

	return {
		update(newOptions: HoverLiftOptions = {}) {
			distance = newOptions.distance ?? 1;
		},
		destroy() {
			node.removeEventListener("mouseenter", onEnter);
			node.removeEventListener("mouseleave", onLeave);
			node.style.transform = "";
			node.style.willChange = "";
		}
	};
}

export interface PressFeedbackOptions {
	/**
	 * Factor de escala al pulsar (0-1). 0.97 por defecto — mismo criterio
	 * de "número afinado, no token" que los porcentajes de `color-mix()`
	 * en `buttons/types.ts` (§11): no existe una escala `--scale-*` en
	 * tokens.css, es un ajuste visual fino, no un valor semántico.
	 */
	scale?: number;
}

/** `use:pressFeedback` — encoge ligeramente el elemento mientras se mantiene pulsado. */
export function pressFeedback(node: HTMLElement, options: PressFeedbackOptions = {}) {
	let scale = options.scale ?? 0.97;

	function apply() {
		if (prefersReducedMotion()) {
			node.style.transition = "";
			return;
		}
		node.style.transition = `transform ${DURATION_MS.fast}ms var(--easing-standard, ease-out)`;
	}

	function onDown() {
		if (prefersReducedMotion()) return;
		node.style.transform = `scale(${scale})`;
	}

	function onRelease() {
		node.style.transform = "";
	}

	apply();
	node.addEventListener("pointerdown", onDown);
	node.addEventListener("pointerup", onRelease);
	node.addEventListener("pointercancel", onRelease);
	node.addEventListener("pointerleave", onRelease);

	return {
		update(newOptions: PressFeedbackOptions = {}) {
			scale = newOptions.scale ?? 0.97;
		},
		destroy() {
			node.removeEventListener("pointerdown", onDown);
			node.removeEventListener("pointerup", onRelease);
			node.removeEventListener("pointercancel", onRelease);
			node.removeEventListener("pointerleave", onRelease);
			node.style.transform = "";
		}
	};
}
