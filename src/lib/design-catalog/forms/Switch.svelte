<script lang="ts">
	/**
	 * Switch (§13) — `<input type="checkbox" role="switch">` nativo
	 * repintado como pista+pulgar. `role="switch"` es lo único que se
	 * añade a la semántica nativa (el checkbox subyacente ya da
	 * marcado/desmarcado, teclado y participación en formularios) — los
	 * lectores de pantalla modernos lo anuncian como "activado/
	 * desactivado" en vez de "marcado/desmarcado", que es la lectura
	 * correcta para un interruptor on/off.
	 */
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLInputAttributes, "size" | "type" | "checked" | "class" | "role"> {
		checked?: boolean;
		size?: ControlSize;
		state?: ControlState;
		label?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		checked = $bindable(false),
		size = "md",
		state = "default",
		disabled = false,
		label,
		class: className = "",
		children,
		...rest
	}: Props = $props();

	let sz = $derived(controlSizeSpec(size));
	// La pista es 1.9x más ancha que alta (proporción estándar de switch),
	// derivada del mismo controlBoxSize que usan Checkbox/Radio para que
	// los tres compartan escala entre tamaños sm/md/lg.
	let style = $derived(
		`--gg-track-h:${sz.controlBoxSize};` +
			`--gg-border:${stateBorderVar(state)};` +
			`--gg-ring:${stateRingVar(state)};` +
			`gap:${sz.gap};`
	);
</script>

<label
	class="gg-switch {className}"
	class:gg-switch--disabled={disabled}
	class:gg-switch--touch={size === "lg"}
	{style}
>
	<input type="checkbox" role="switch" bind:checked {disabled} class="gg-switch__input" {...rest} />
	<span class="gg-switch__track" aria-hidden="true">
		<span class="gg-switch__thumb"></span>
	</span>
	{#if label || children}
		<span class="gg-switch__label" style="font-size:{sz.fontSize};line-height:{sz.lineHeight};">
			{#if children}{@render children()}{:else}{label}{/if}
		</span>
	{/if}
</label>

<style>
	.gg-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		font-family: var(--font-sans);
		color: var(--text-primary);
	}

	.gg-switch--disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Área de impacto táctil — ver la nota equivalente en Checkbox.svelte
	   (mismo criterio, --target-min, solo size="lg"). */
	.gg-switch--touch::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-switch__input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.gg-switch__track {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		width: calc(var(--gg-track-h) * 1.9);
		height: var(--gg-track-h);
		flex-shrink: 0;
		border-radius: var(--radius-full);
		border: 1.5px solid var(--gg-border);
		/* neutral-500 A PROPÓSITO, no --surface-sunken: el thumb blanco de
		   abajo necesita ≥3:1 (WCAG 1.4.11, límite de componente no
		   textual) contra el fondo de la pista en "apagado", y
		   --surface-sunken da 1.2:1 en claro (casi blanco sobre casi
		   blanco) — neutral-500 es el paso de la escala más claro que
		   sigue pasando 3:1 en AMBOS temas (4.32:1, verificado), porque es
		   un token de escala invariante por tema, no un alias que cambia
		   de paso entre claro/oscuro. */
		background: var(--neutral-500);
		padding: 2px;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard);
	}

	.gg-switch__thumb {
		width: calc(var(--gg-track-h) * 0.72);
		height: calc(var(--gg-track-h) * 0.72);
		border-radius: var(--radius-full);
		/* Blanco fijo (no --color-on-primary, que se invierte a negro en
		   oscuro) — comprobado ≥3:1 contra los 3 fondos de pista posibles:
		   neutral-500 (apagado, 4.32:1), primary-400 (encendido oscuro,
		   4.12:1), primary-600 (encendido claro, 7.76:1). */
		background: var(--color-white);
		box-shadow: var(--shadow-raised);
		transform: translateX(0);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-switch__input:checked ~ .gg-switch__track {
		background: var(--surface-button-primary);
		border-color: var(--surface-button-primary);
	}

	.gg-switch__input:checked ~ .gg-switch__track .gg-switch__thumb {
		transform: translateX(calc(var(--gg-track-h) * 0.9));
	}

	.gg-switch__input:focus-visible ~ .gg-switch__track {
		outline: 2px solid var(--gg-ring);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-switch__track,
		.gg-switch__thumb {
			transition: none;
		}
	}
</style>
