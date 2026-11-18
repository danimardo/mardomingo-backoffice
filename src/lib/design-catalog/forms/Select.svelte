<script lang="ts">
	/**
	 * Select (§13) — un `<select>` NATIVO repintado (appearance:none +
	 * flecha propia), no un listbox/combobox a medida.
	 *
	 * Decisión de alcance deliberada: la especificación lista `Select` Y
	 * `NativeSelect` como piezas separadas (§13), pero la Fase 2 (§69)
	 * solo pide "Select" — sin más precisión. Construir un listbox
	 * accesible de verdad (patrón ARIA 1.2 combobox/listbox: roving
	 * tabindex, typeahead, posicionamiento que no se recorte dentro de
	 * paneles con overflow, anuncios de lector de pantalla al abrir/
	 * cerrar) es semanas de trabajo hechas bien, o una réplica que
	 * PARECE accesible y no lo es hecha rápido — ninguna de las dos encaja
	 * en esta entrega. `<select>` nativo da teclado, lector de pantalla,
	 * selector táctil de móvil/escritorio y participación en formularios
	 * gratis y correctos. Un Combobox/MultiSelect a medida queda para
	 * cuando de verdad se aborde esa pieza, no como añadido apresurado
	 * aquí. Ver docs/COMPONENTS.md.
	 *
	 * Corrección de Fase 6 (bug de origen en Fase 2, ver docs/ROADMAP.md
	 * y el mismo comentario en `Input.svelte`/`TextArea.svelte`): `style`
	 * llegaba por `...rest` y, al repartirse DESPUÉS de `style={fieldStyle}`
	 * en el `<select>`, un `style` del consumidor borraba el padding/
	 * tipografía calculados en vez de sumarse. Ahora es una prop
	 * explícita, excluida de `...rest`, aplicada al SPAN envoltorio
	 * (`wrapperStyle`, el que tiene `width:100%` y el que de verdad hace
	 * falta poder acotar con un `max-width` desde fuera).
	 */
	import type { HTMLSelectAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import { Icon } from "../icons/index.js";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLSelectAttributes, "size" | "value" | "class" | "style"> {
		value?: string;
		size?: ControlSize;
		state?: ControlState;
		/** v1.12.0: solo lectura. Sigue siendo enfocable (con `aria-readonly`), no abre la lista y no muestra chevron. */
		readonly?: boolean;
		class?: string;
		style?: string;
		children: Snippet;
		/** v1.12.0: contenido a continuación del valor (un `Chip`, una marca de verificación…). */
		after?: Snippet;
	}

	let {
		value = $bindable(""),
		size = "md",
		state = "default",
		readonly = false,
		disabled = false,
		class: className = "",
		style: styleProp = "",
		id,
		children,
		after,
		...rest
	}: Props = $props();

	// <select> no tiene `readonly` nativo: se impide abrirlo con ratón y teclado, sin sacarlo del orden de tabulación.
	function blockOpen(e: Event) {
		if (!readonly) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).focus();
	}
	function blockKeys(e: KeyboardEvent) {
		if (!readonly) return;
		if (["ArrowUp", "ArrowDown", " ", "Enter", "Home", "End", "PageUp", "PageDown"].includes(e.key) || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) e.preventDefault();
	}

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};` +
			`border-color:${stateBorderVar(state)};` +
			`--gg-input-ring:${stateRingVar(state)};` +
			styleProp
	);
	let fieldStyle = $derived(
		`padding:${sz.paddingY} calc(${sz.paddingX} * 2.2) ${sz.paddingY} ${sz.paddingX};` +
			`font-size:${sz.fontSize};` +
			`line-height:${sz.lineHeight};`
	);
</script>

<span class="gg-select {className}" class:gg-select--disabled={disabled} class:gg-select--readonly={readonly} style={wrapperStyle}>
	<select
		{id}
		bind:value
		{disabled}
		aria-invalid={state === "error" ? "true" : undefined}
		aria-readonly={readonly ? "true" : undefined}
		class="gg-select__field"
		style={fieldStyle}
		onmousedown={blockOpen}
		onkeydown={blockKeys}
		{...rest}
	>
		{@render children()}
	</select>
	{#if after}<span class="gg-select__after">{@render after()}</span>{/if}
	{#if !readonly}
		<Icon
			name="chevron-down"
			class="gg-select__chevron"
			size={16}
			legacySvg={{
				viewBox: "0 0 16 16",
				fill: "none",
				body: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 6l4 4 4-4" />'
			}}
		/>
	{/if}
</span>

<style>
	.gg-select {
		box-sizing: border-box;
		position: relative;
		display: inline-flex;
		align-items: center;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-select:focus-within {
		border-color: var(--gg-input-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-input-ring) 30%, transparent);
	}

	.gg-select--disabled {
		opacity: 0.5;
	}

	.gg-select--readonly {
		background: var(--surface-sunken);
	}

	.gg-select--readonly .gg-select__field {
		cursor: default;
	}

	.gg-select__after {
		display: inline-flex;
		align-items: center;
		padding-inline-end: var(--space-3);
		color: var(--text-muted);
	}

	.gg-select__field {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
	}

	.gg-select__field:disabled {
		cursor: not-allowed;
	}

	:global(.gg-select__chevron) {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-select {
			transition: none;
		}
	}
</style>
