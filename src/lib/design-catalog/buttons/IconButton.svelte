<script lang="ts">
	/**
	 * IconButton (§11.2) — botón cuadrado, solo icono. `label` es
	 * obligatorio (no opcional) porque se usa como aria-label: un botón
	 * sin texto visible y sin nombre accesible es invisible para un
	 * lector de pantalla — mismo criterio de accesibilidad ya aplicado a
	 * Tooltip/Dialog en NetworkBench.
	 *
	 * El resto de atributos nativos (aria-*, data-*...) se pasan por
	 * `...rest` — mismo motivo que en `Button.svelte` (Fase 3,
	 * `DropdownMenu` como disparador).
	 */
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import type { ButtonSize, ButtonVariant } from "./types.js";
	import { sizeSpec, variantSpec } from "./types.js";

	interface Props extends Omit<HTMLButtonAttributes, "type" | "disabled" | "class" | "style" | "onclick"> {
		/** Nombre accesible del botón — obligatorio, no hay texto visible que lo sustituya. */
		label: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: "button" | "submit" | "reset";
		disabled?: boolean | undefined;
		loading?: boolean;
		class?: string;
		style?: string;
		icon: Snippet;
		onclick?: ((e: MouseEvent) => void) | undefined;
	}

	let {
		label,
		variant = "ghost",
		size = "md",
		type = "button",
		disabled = false,
		loading = false,
		class: className = "",
		style: styleProp = "",
		icon,
		onclick,
		...rest
	}: Props = $props();

	let isDisabled = $derived(disabled || loading);

	let inlineStyle = $derived(
		(() => {
			const sz = sizeSpec(size);
			const v = variantSpec(variant);
			return (
				`width:${sz.iconOnlySize};` +
				`height:${sz.iconOnlySize};` +
				`border-radius:${sz.radius};` +
				`background:${v.background};` +
				`color:${v.color};` +
				`border:${v.border};` +
				`--gg-btn-hover-bg:${v.hoverBackground};` +
				`--gg-btn-active-bg:${v.activeBackground};` +
				styleProp
			);
		})()
	);
</script>

<button
	{type}
	class="gg-icon-btn bc-pressable {className}"
	style={inlineStyle}
	disabled={isDisabled}
	aria-busy={loading}
	aria-label={label}
	title={label}
	{onclick}
	{...rest}
>
	{#if loading}
		<span class="gg-icon-btn__spinner" aria-hidden="true"></span>
	{:else}
		<span class="gg-icon-btn__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
</button>

<style>
	.gg-icon-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-family: var(--font-sans);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			opacity var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-icon-btn:hover:not(:disabled) {
		background: var(--gg-btn-hover-bg);
	}

	.gg-icon-btn:active:not(:disabled) {
		background: var(--gg-btn-active-bg);
	}

	.gg-icon-btn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-icon-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-icon-btn__icon {
		display: inline-flex;
		width: 1.15em;
		height: 1.15em;
	}

	.gg-icon-btn__spinner {
		width: 1.15em;
		height: 1.15em;
		border-radius: var(--radius-full);
		border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
		border-top-color: currentColor;
		animation: gg-icon-btn-spin var(--duration-slow) linear infinite;
	}

	@keyframes gg-icon-btn-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-icon-btn {
			transition: none;
		}

		.gg-icon-btn__spinner {
			animation: none;
		}
	}
</style>
