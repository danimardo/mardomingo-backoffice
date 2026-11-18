<script lang="ts">
	/**
	 * Accordion — secciones de contenido que se expanden/colapsan
	 * (candidato #9 de la ronda de ampliación post-v0.13.0, ver
	 * docs/ROADMAP.md), construido sobre `ExpandCollapse` ya existente
	 * (Fase 8/motion) en vez de reimplementar la transición de alto —
	 * `Accordion`/`AccordionItem` solo añaden la SEMÁNTICA (cabecera +
	 * panel, patrón WAI-ARIA "Accordion") y la navegación por teclado
	 * encima.
	 *
	 * Vive en `navigation/` junto a `Tabs`/`Menu`/`DropdownMenu`: como
	 * ellos, es un control interactivo de revelar/ocultar contenido con
	 * su propia navegación por teclado — no un literal "ir a otra
	 * pantalla", pero la misma familia de piezas que ya comparten esta
	 * carpeta (criterio ya establecido por `Menu`/`CommandMenu`, que
	 * tampoco "navegan" en sentido estricto).
	 *
	 * `Accordion` (este fichero) gestiona qué valores están abiertos —
	 * mismo reparto de responsabilidad que `Tabs`/`TabPanel`: el
	 * contenedor posee el estado, cada `AccordionItem` lo lee por
	 * contexto. `multiple` decide si abrir una sección cierra las demás
	 * (modo por defecto, un acordeón "clásico") o si pueden convivir
	 * varias abiertas a la vez.
	 *
	 * Teclado (patrón ARIA "Accordion"): Flecha-abajo/arriba mueve el
	 * foco entre cabeceras (no activa por sí sola, a diferencia de
	 * `Tabs` — aquí cada cabecera es un `<button>` normal, Intro/Espacio
	 * la activan de forma nativa), Inicio/Fin van a la primera/última.
	 */
	import { setContext } from "svelte";
	import type { Snippet } from "svelte";

	export interface AccordionContext {
		isOpen: (value: string) => boolean;
		toggle: (value: string) => void;
		register: (value: string, el: HTMLButtonElement) => void;
		unregister: (value: string) => void;
		moveFocus: (fromValue: string, direction: 1 | -1) => void;
		focusFirst: () => void;
		focusLast: () => void;
		readonly uid: string;
	}

	interface Props {
		multiple?: boolean;
		openValues?: string[];
		class?: string;
		children: Snippet;
	}

	let { multiple = false, openValues = $bindable([]), class: className = "", children }: Props = $props();

	let order: string[] = $state([]);
	const refs: Record<string, HTMLButtonElement> = {};

	function isOpen(value: string): boolean {
		return openValues.includes(value);
	}

	function toggle(value: string) {
		if (isOpen(value)) {
			openValues = openValues.filter((v) => v !== value);
		} else {
			openValues = multiple ? [...openValues, value] : [value];
		}
	}

	function register(value: string, el: HTMLButtonElement) {
		refs[value] = el;
		if (!order.includes(value)) order = [...order, value];
	}

	function unregister(value: string) {
		delete refs[value];
		order = order.filter((v) => v !== value);
	}

	function moveFocus(fromValue: string, direction: 1 | -1) {
		const idx = order.indexOf(fromValue);
		if (idx === -1 || order.length === 0) return;
		let next = idx;
		// Salta cabeceras deshabilitadas — mismo criterio que
		// `focusableIndex` de `Tabs`/`SegmentedControl` (nunca enfocar un
		// `<button disabled>`, que de todas formas ni aceptaría el foco).
		for (let tries = 0; tries < order.length; tries++) {
			next = (next + direction + order.length) % order.length;
			const el = refs[order[next] ?? -1];
			if (el && !el.disabled) {
				el.focus();
				return;
			}
		}
	}

	function focusFirst() {
		const target = order.find((v) => !refs[v]?.disabled);
		if (target) refs[target]?.focus();
	}

	function focusLast() {
		const target = [...order].reverse().find((v) => !refs[v]?.disabled);
		if (target) refs[target]?.focus();
	}

	const uid = $props.id();

	setContext<AccordionContext>("gg-accordion", {
		isOpen,
		toggle,
		register,
		unregister,
		moveFocus,
		focusFirst,
		focusLast,
		uid
	});
</script>

<div class="gg-accordion {className}">
	{@render children()}
</div>

<style>
	.gg-accordion {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border-subtle);
	}
</style>
