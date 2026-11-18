<script lang="ts">
	/**
	 * Heading — encabezado semántico h1-h6 (§7.2, §65, §63 accesibilidad).
	 *
	 * `level` fija el tag HTML real (h1..h6) para que el árbol de
	 * encabezados de la página sea correcto para lectores de pantalla.
	 * `step` fija el ASPECTO visual (qué paso de la escala tipográfica se
	 * aplica) y es independiente de `level` a propósito: la jerarquía
	 * visual y la jerarquía semántica no siempre coinciden (p. ej. un
	 * <h2> de sección que debe leer visualmente como display-2 dentro de
	 * una cabecera de página). Por defecto `step` seep del `level`, así
	 * el caso común (visual == semántico) no requiere pasar dos props.
	 */
	import type { Snippet } from "svelte";
	import type { TextTone } from "./types.js";
	import { TONE_VAR } from "./types.js";

	type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
	type HeadingStep = "display-1" | "display-2" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

	const LEVEL_TO_DEFAULT_STEP: Record<HeadingLevel, HeadingStep> = {
		1: "h1",
		2: "h2",
		3: "h3",
		4: "h4",
		5: "h5",
		6: "h6"
	};

	interface Props {
		/** Nivel semántico — decide el tag <h1>..<h6>. */
		level: HeadingLevel;
		/** Paso visual; por defecto el que corresponde a `level`. */
		step?: HeadingStep;
		tone?: TextTone;
		truncate?: boolean;
		class?: string;
		children?: Snippet;
	}

	let { level, step, tone = "primary", truncate = false, class: className = "", children }: Props = $props();

	let resolvedStep = $derived(step ?? LEVEL_TO_DEFAULT_STEP[level]);
	let colorValue = $derived(tone === "inherit" ? "inherit" : TONE_VAR[tone]);
	let inlineStyle = $derived(
		`font-size:var(--text-${resolvedStep}-size);` +
			`line-height:var(--text-${resolvedStep}-leading);` +
			`font-weight:var(--text-${resolvedStep}-weight);` +
			`color:${colorValue};`
	);

	const TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
</script>

<svelte:element
	this={TAGS[level - 1]}
	class="gg-heading {truncate ? 'gg-heading--truncate' : ''} {className}"
	style={inlineStyle}
>
	{@render children?.()}
</svelte:element>

<style>
	.gg-heading {
		font-family: var(--font-sans);
		margin: 0;
	}

	.gg-heading--truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
</style>
