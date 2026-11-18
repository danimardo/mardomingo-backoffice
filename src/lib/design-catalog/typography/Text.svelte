<script lang="ts">
	/**
	 * Text — pieza tipográfica genérica (§7.2, §65). Cubre cualquier texto
	 * que NO sea un encabezado semántico: cuerpo, subtítulos, etiquetas,
	 * código inline, captions. Para h1-h6 usa <Heading>, que comparte esta
	 * misma escala mediante typography/types.ts.
	 *
	 * El tamaño/interlineado/peso salen de los tokens --text-{step}-* de
	 * tokens.css (nunca un valor suelto); el color sale de TONE_VAR
	 * (alias de --text-* / --status-*). Así un cambio de tema o de tokens
	 * no requiere tocar este componente.
	 */
	import type { Snippet } from "svelte";
	import type { TextStep, TextTone } from "./types.js";
	import { TONE_VAR } from "./types.js";

	interface Props {
		/** Paso de la escala tipográfica (§7.2). */
		step?: TextStep;
		/** Color semántico. "inherit" no fija color, lo hereda del contenedor. */
		tone?: TextTone;
		/** Elemento HTML a renderizar — desacoplado del paso visual. */
		as?: "span" | "p" | "div" | "label" | "small" | "code";
		/** Recorta a una sola línea con ellipsis si no cabe. */
		truncate?: boolean;
		/** Clases utilitarias adicionales (layout, márgenes) vía Tailwind. */
		class?: string;
		children?: Snippet;
	}

	let {
		step = "body",
		tone = "primary",
		as = "span",
		truncate = false,
		class: className = "",
		children
	}: Props = $props();

	let colorValue = $derived(tone === "inherit" ? "inherit" : TONE_VAR[tone]);

	// Construido como un único string de estilo en línea: el directive
	// style:x="var(--y-{expr})" no es fiable para nombres de variable
	// interpolados en todas las versiones de Svelte, así que se arma
	// aquí un valor ya resuelto.
	let inlineStyle = $derived(
		`font-size:var(--text-${step}-size);` +
			`line-height:var(--text-${step}-leading);` +
			`font-weight:var(--text-${step}-weight);` +
			`color:${colorValue};`
	);
</script>

<svelte:element
	this={as}
	class="gg-text {truncate ? 'gg-text--truncate' : ''} {className}"
	style={inlineStyle}
>
	{@render children?.()}
</svelte:element>

<style>
	.gg-text {
		font-family: var(--font-sans);
		margin: 0;
	}

	.gg-text--truncate {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
</style>
