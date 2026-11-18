/**
 * `use:tooltip` (§26, catálogo completo — "Tooltip") — overlay NO modal
 * más simple del paquete: una etiqueta de ayuda que aparece al pasar el
 * ratón o al enfocar por teclado, y desaparece al salir/perder el foco/
 * Escape. Deliberadamente una ACCIÓN, no un componente — mismo criterio
 * que `hoverLift`/`pressFeedback` (Fase 8): se cuelga directamente del
 * elemento disparador real del consumidor (un `<button>`, un icono...)
 * en vez de exigir un snippet `trigger` + `triggerProps` que reenviar a
 * mano (el patrón que sí hace falta en `DropdownMenu`/`Popover` porque
 * ahí el contenido del popover es arbitrario y complejo — aquí es una
 * sola cadena de texto).
 *
 * El nodo tooltip en sí NO es un componente Svelte: se crea/destruye
 * como DOM imperativo y se monta en `document.body` (mismo motivo que
 * `portal.ts` — escapar de cualquier ancestro con `overflow`/
 * `transform`), porque una acción no tiene forma de montar un
 * componente Svelte por sí misma sin recurrir a `mount()` de
 * `svelte`, que sería más código para el mismo resultado. Todo el
 * estilo va en `element.style` con `var(--token)` (nunca un literal
 * hex/px/rem, igual que el resto del paquete) para no depender de que
 * el consumidor haya cargado una hoja de estilos global.
 *
 * Patrón WAI-ARIA "Tooltip": `role="tooltip"` en el propio nodo,
 * `aria-describedby` en el DISPARADOR (no al revés) apuntando a su id,
 * se muestra en `mouseenter`/`focus`, se oculta en `mouseleave`/`blur`/
 * Escape. Sin retraso de aparición — un retardo deliberado añadiría
 * complejidad/inestabilidad a la verificación con Playwright sin
 * beneficio de accesibilidad real.
 */

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipOptions {
	content: string;
	placement?: TooltipPlacement;
}

let uidCounter = 0;

export function tooltip(node: HTMLElement, options: TooltipOptions) {
	let opts = options;
	const id = `gg-tooltip-${++uidCounter}`;
	let tipEl: HTMLDivElement | null = null;

	function position() {
		if (!tipEl) return;
		const placement = opts.placement ?? "top";
		const triggerRect = node.getBoundingClientRect();
		const tipRect = tipEl.getBoundingClientRect();
		const gap = 6; // separación fija en px de pantalla entre disparador y tooltip — ver nota abajo sobre por qué no es un --space-*.

		let top = 0;
		let left = 0;
		if (placement === "top") {
			top = triggerRect.top - tipRect.height - gap;
			left = triggerRect.left + (triggerRect.width - tipRect.width) / 2;
		} else if (placement === "bottom") {
			top = triggerRect.bottom + gap;
			left = triggerRect.left + (triggerRect.width - tipRect.width) / 2;
		} else if (placement === "left") {
			top = triggerRect.top + (triggerRect.height - tipRect.height) / 2;
			left = triggerRect.left - tipRect.width - gap;
		} else {
			top = triggerRect.top + (triggerRect.height - tipRect.height) / 2;
			left = triggerRect.right + gap;
		}

		// Recorte a viewport — un tooltip que se sale de la ventana es peor
		// que uno ligeramente descentrado respecto a su disparador.
		left = Math.min(Math.max(gap, left), window.innerWidth - tipRect.width - gap);
		top = Math.min(Math.max(gap, top), window.innerHeight - tipRect.height - gap);

		tipEl.style.top = `${top}px`;
		tipEl.style.left = `${left}px`;
	}

	function show() {
		// v1.7.0: un contenido vacío no muestra nada (permite colgar la acción
		// de celdas que solo a veces tienen algo que decir).
		if (tipEl || !opts.content) return;
		tipEl = document.createElement("div");
		tipEl.id = id;
		tipEl.setAttribute("role", "tooltip");
		tipEl.textContent = opts.content;
		// `gap` de posicionamiento aparte, TODO lo demás pasa por var(--token)
		// — mismo criterio que `verify-no-stray-literals.mjs` exige en
		// cualquier .svelte/.ts de src/lib.
		tipEl.style.cssText = [
			"position:fixed;",
			"z-index:var(--z-tooltip);",
			"box-sizing:border-box;",
			"max-width:var(--space-64);",
			"padding:var(--space-1) var(--space-3);",
			"border-radius:var(--radius-sm);",
			"background:var(--surface-overlay);",
			"color:var(--text-primary);",
			"box-shadow:var(--shadow-overlay);",
			"font-family:var(--font-sans);",
			"font-size:var(--text-caption-size);",
			"line-height:var(--text-caption-leading);",
			"pointer-events:none;"
		].join("");
		document.body.appendChild(tipEl);
		node.setAttribute("aria-describedby", id);
		position();
	}

	function hide() {
		tipEl?.remove();
		tipEl = null;
		node.removeAttribute("aria-describedby");
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") hide();
	}

	// v1.7.0: un `title` igual al contenido sirve de respaldo sin JavaScript
	// (lo pinta el SSR); con la acción activa se retira para no mostrar dos
	// tooltips a la vez.
	if (node.getAttribute("title") === opts.content) node.removeAttribute("title");

	node.addEventListener("mouseenter", show);
	node.addEventListener("mouseleave", hide);
	node.addEventListener("focus", show);
	node.addEventListener("blur", hide);
	node.addEventListener("keydown", onKeydown);

	return {
		update(newOptions: TooltipOptions) {
			opts = newOptions;
			if (tipEl && !opts.content) hide();
			if (tipEl) {
				tipEl.textContent = opts.content;
				position();
			}
		},
		destroy() {
			node.removeEventListener("mouseenter", show);
			node.removeEventListener("mouseleave", hide);
			node.removeEventListener("focus", show);
			node.removeEventListener("blur", hide);
			node.removeEventListener("keydown", onKeydown);
			hide();
		}
	};
}
