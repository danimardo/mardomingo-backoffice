<script lang="ts">
	/**
	 * Checkbox (§13) — un `<input type="checkbox">` NATIVO, visualmente
	 * repintado (appearance:none + una caja propia dibujada con
	 * ::after/mask), nunca una `<div>` con manejadores de teclado a mano.
	 * Mismo criterio de accesibilidad que ya se aplicó en NetworkBench
	 * (C04): la semántica nativa (Espacio para marcar, anuncio de
	 * checked/unchecked por el lector de pantalla, formar parte de un
	 * `<form>`) es gratis y correcta; reimplementarla con ARIA a mano casi
	 * siempre queda peor.
	 *
	 * `indeterminate` es una PROPIEDAD del DOM, no un atributo HTML — por
	 * eso se fija con `bind:indeterminate` en vez de un atributo plano.
	 */
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLInputAttributes, "size" | "type" | "checked" | "class"> {
		checked?: boolean;
		indeterminate?: boolean;
		size?: ControlSize;
		state?: ControlState;
		label?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		checked = $bindable(false),
		indeterminate = $bindable(false),
		size = "md",
		state = "default",
		disabled = false,
		label,
		class: className = "",
		children,
		...rest
	}: Props = $props();

	let sz = $derived(controlSizeSpec(size));
	let style = $derived(
		`--gg-box-size:${sz.controlBoxSize};` +
			`--gg-box-border:${stateBorderVar(state)};` +
			`--gg-box-ring:${stateRingVar(state)};` +
			`gap:${sz.gap};`
	);
</script>

<label
	class="gg-checkbox {className}"
	class:gg-checkbox--disabled={disabled}
	class:gg-checkbox--touch={size === "lg"}
	{style}
>
	<input type="checkbox" bind:checked bind:indeterminate {disabled} class="gg-checkbox__input" {...rest} />
	<span class="gg-checkbox__box" aria-hidden="true"></span>
	{#if label || children}
		<span class="gg-checkbox__label" style="font-size:{sz.fontSize};line-height:{sz.lineHeight};">
			{#if children}{@render children()}{:else}{label}{/if}
		</span>
	{/if}
</label>

<style>
	.gg-checkbox {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		font-family: var(--font-sans);
		color: var(--text-primary);
	}

	.gg-checkbox--disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — solo
	   size="lg": pseudo-elemento invisible centrado sobre el `<label>`
	   entero, nunca más pequeño que --target-min en ningún eje, sin
	   cambiar el tamaño/pintado visible de la caja ni del texto. */
	.gg-checkbox--touch::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-checkbox__input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.gg-checkbox__box {
		box-sizing: border-box;
		width: var(--gg-box-size);
		height: var(--gg-box-size);
		flex-shrink: 0;
		border-radius: var(--radius-xs);
		border: 1.5px solid var(--gg-box-border);
		background: var(--surface);
		position: relative;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard);
	}

	.gg-checkbox__box::after {
		content: "";
		position: absolute;
		inset: 0;
		background: var(--color-on-primary);
		opacity: 0;
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E")
			center / 70% no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E")
			center / 70% no-repeat;
	}

	.gg-checkbox__input:checked + .gg-checkbox__box,
	.gg-checkbox__input:indeterminate + .gg-checkbox__box {
		background: var(--surface-button-primary);
		border-color: var(--surface-button-primary);
	}

	.gg-checkbox__input:checked + .gg-checkbox__box::after,
	.gg-checkbox__input:indeterminate + .gg-checkbox__box::after {
		opacity: 1;
	}

	/* Indeterminado: una raya en vez del check — misma técnica de mask,
	   solo cambia el path. */
	.gg-checkbox__input:indeterminate + .gg-checkbox__box::after {
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' d='M3.5 8h9'/%3E%3C/svg%3E")
			center / 70% no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' d='M3.5 8h9'/%3E%3C/svg%3E")
			center / 70% no-repeat;
	}

	.gg-checkbox__input:focus-visible + .gg-checkbox__box {
		outline: 2px solid var(--gg-box-ring);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-checkbox__box {
			transition: none;
		}
	}
</style>
