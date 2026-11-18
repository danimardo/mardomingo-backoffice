<script lang="ts">
	/**
	 * Button (§11.1) — botón con texto (y, opcionalmente, un icono via el
	 * snippet `icon`). Para un botón SOLO de icono usa IconButton, que
	 * exige `label` (accesibilidad — un botón sin texto visible necesita
	 * un nombre accesible, mismo criterio que ya se aplicó en NetworkBench
	 * a Tooltip/Dialog).
	 *
	 * `loading` desactiva el botón (pointer-events, aria-busy) y sustituye
	 * el contenido por un spinner — bajo `prefers-reduced-motion: reduce`
	 * el spinner deja de rotar en vez de ocultarse (sigue comunicando
	 * "ocupado" sin depender del movimiento), el mismo criterio de
	 * accesibilidad que ProgressBar aplicaba en NetworkBench.
	 *
	 * El resto de atributos nativos (aria-*, data-*, name...) se pasan
	 * por `...rest` — mismo criterio que ya usan Input/TextArea/Select
	 * (§12). Hacía falta para Fase 3: `DropdownMenu` compone su
	 * disparador dándole `aria-haspopup`/`aria-expanded`/`aria-controls`
	 * a través de un snippet, y sin `...rest` esos atributos se perdían
	 * en silencio si el disparador era un `<Button>`.
	 */
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import type { ButtonSize, ButtonVariant } from "./types.js";
	import { sizeSpec, variantSpec } from "./types.js";

	// Base genérica (HTMLElement), no HTMLButtonAttributes: Button puede
	// renderizar <a> o <button> según `href`, y los manejadores de evento
	// tipados para HTMLButtonElement no son asignables a <a> (elementos
	// hermanos, no uno superclase del otro). El resto (aria-*, data-*,
	// id...) es lo que de verdad hace falta pasar — atributos específicos
	// de <button> (form, formaction...) quedan fuera a cambio.
	interface Props extends Omit<HTMLAttributes<HTMLElement>, "type" | "disabled" | "class" | "style" | "onclick"> {
		variant?: ButtonVariant | undefined;
		size?: ButtonSize | undefined;
		type?: "button" | "submit" | "reset" | undefined;
		disabled?: boolean | undefined;
		loading?: boolean | undefined;
		/** Si se indica, el botón se renderiza como <a href=...>. */
		href?: string | undefined;
		fullWidth?: boolean | undefined;
		class?: string | undefined;
		style?: string | undefined;
		icon?: Snippet | undefined;
		iconPosition?: "start" | "end" | undefined;
		children?: Snippet;
		onclick?: ((e: MouseEvent) => void) | undefined;
	}

	let {
		variant = "primary",
		size = "md",
		type = "button",
		disabled = false,
		loading = false,
		href,
		fullWidth = false,
		class: className = "",
		style: styleProp = "",
		icon,
		iconPosition = "start",
		children,
		onclick,
		...rest
	}: Props = $props();

	let isDisabled = $derived(disabled || loading);

	let inlineStyle = $derived(
		(() => {
			const sz = sizeSpec(size);
			const v = variantSpec(variant);
			return (
				`padding:${sz.paddingY} ${sz.paddingX};` +
				`gap:${sz.gap};` +
				`font-size:${sz.fontSize};` +
				`line-height:${sz.lineHeight};` +
				`font-weight:${sz.fontWeight};` +
				`border-radius:${sz.radius};` +
				`background:${v.background};` +
				`color:${v.color};` +
				`border:${v.border};` +
				`--gg-btn-hover-bg:${v.hoverBackground};` +
				`--gg-btn-active-bg:${v.activeBackground};` +
				(fullWidth ? "width:100%;" : "") +
				styleProp
			);
		})()
	);
</script>

{#snippet content()}
	{#if loading}
		<span class="gg-btn__spinner" aria-hidden="true"></span>
	{:else if icon && iconPosition === "start"}
		<span class="gg-btn__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	{#if children}
		<span class="gg-btn__label" class:gg-btn__label--hidden={loading}>{@render children()}</span>
	{/if}
	{#if !loading && icon && iconPosition === "end"}
		<span class="gg-btn__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
{/snippet}

{#if href && !isDisabled}
	<a {href} class="gg-btn gg-btn--{variant} bc-pressable {className}" style={inlineStyle} aria-busy={loading} {...rest}>
		{@render content()}
	</a>
{:else}
	<button
		{type}
		class="gg-btn gg-btn--{variant} bc-pressable {className}"
		style={inlineStyle}
		disabled={isDisabled}
		aria-busy={loading}
		{onclick}
		{...rest}
	>
		{@render content()}
	</button>
{/if}

<style>
	.gg-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-sans);
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			opacity var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-btn:hover:not(:disabled) {
		background: var(--gg-btn-hover-bg);
	}

	.gg-btn:active:not(:disabled) {
		background: var(--gg-btn-active-bg);
	}

	.gg-btn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-btn__label--hidden {
		visibility: hidden;
	}

	.gg-btn__icon {
		display: inline-flex;
	}

	.gg-btn__spinner {
		width: 1em;
		height: 1em;
		border-radius: var(--radius-full);
		border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
		border-top-color: currentColor;
		animation: gg-btn-spin var(--duration-slow) linear infinite;
	}

	@keyframes gg-btn-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-btn {
			transition: none;
		}

		.gg-btn__spinner {
			animation: none;
		}
	}
</style>
