<script lang="ts">
	/**
	 * TextArea (§12) — control multilínea. Mismo sistema de tamaño/estado
	 * que Input, pero es su propio componente (no una variante de Input)
	 * porque la especificación lo lista aparte y su comportamiento nativo
	 * (`rows`, `resize`) no tiene equivalente en `<input>`.
	 *
	 * Fuera de alcance a propósito: auto-crecimiento (`AutoGrowTextArea`
	 * es una pieza propia en el catálogo completo de la especificación,
	 * no está en la lista curada de la Fase 2 — añadirlo aquí como prop
	 * habría sido la misma "prop demasiado específica" que §65 pide
	 * evitar). Si hace falta, se implementa como su propio componente en
	 * una fase posterior.
	 *
	 * Corrección de Fase 6 (bug de origen en Fase 2, ver docs/ROADMAP.md):
	 * `style` no tenía prop propia — llegaba por `...rest` y, al
	 * repartirse DESPUÉS de `style={fieldStyle}` en el elemento, un
	 * `style` del consumidor BORRABA por completo el padding/tipografía/
	 * radio calculados (spread posterior gana sobre atributo explícito
	 * anterior para el mismo nombre) en vez de sumarse. Mismo problema
	 * en `Input`/`Select` — los tres se corrigen igual: `style` pasa a
	 * ser una prop explícita, excluida de `...rest`, y se concatena
	 * DESPUÉS de `fieldStyle` en el mismo atributo (incluso vacía por
	 * defecto, para que ganar/perder no dependa del orden del spread).
	 */
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLTextareaAttributes, "value" | "class" | "style"> {
		value?: string;
		size?: ControlSize;
		state?: ControlState;
		resize?: "none" | "vertical" | "horizontal" | "both";
		class?: string;
		style?: string;
	}

	let {
		value = $bindable(""),
		size = "md",
		state = "default",
		resize = "vertical",
		disabled = false,
		readonly = false,
		rows = 4,
		class: className = "",
		style: styleProp = "",
		...rest
	}: Props = $props();

	let sz = $derived(controlSizeSpec(size));
	let fieldStyle = $derived(
		`padding:${sz.paddingY} ${sz.paddingX};` +
			`font-size:${sz.fontSize};` +
			`line-height:${sz.lineHeight};` +
			`border-radius:${sz.radius};` +
			`border-color:${stateBorderVar(state)};` +
			`resize:${resize};` +
			`--gg-input-ring:${stateRingVar(state)};` +
			styleProp
	);
</script>

<textarea
	bind:value
	{disabled}
	{readonly}
	{rows}
	aria-invalid={state === "error" ? "true" : undefined}
	class="gg-textarea {className}"
	style={fieldStyle}
	{...rest}
></textarea>

<style>
	.gg-textarea {
		box-sizing: border-box;
		display: block;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-textarea::placeholder {
		color: var(--text-muted);
	}

	.gg-textarea:focus-visible {
		outline: none;
		border-color: var(--gg-input-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-input-ring) 30%, transparent);
	}

	.gg-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-textarea:read-only {
		cursor: default;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-textarea {
			transition: none;
		}
	}
</style>
