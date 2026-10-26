<script lang="ts">
	// Botón del sistema de diseño (DS-10). Es un `<button>` dentro de un formulario, o un `<a>` con `href`.
	// Objetivo táctil de 44 × 44 px como mínimo, foco visible y `aria-busy` durante un envío. Sin reglas de
	// «aspecto nativo»: el cursor, la selección y el subrayado son los del navegador.
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost';

	interface Props {
		variant?: Variant;
		/** Si se da, el control es un enlace; el llamador debe pasar la ruta ya resuelta. */
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		name?: string;
		value?: string;
		formaction?: string;
		disabled?: boolean;
		busy?: boolean;
		/** Estado de «opción actual» de un grupo de botones (`aria-pressed`). */
		pressed?: boolean;
		children: Snippet;
		icon?: Snippet;
	}

	let {
		variant = 'secondary',
		href,
		type = 'button',
		name,
		value,
		formaction,
		disabled = false,
		busy = false,
		pressed,
		children,
		icon
	}: Props = $props();
</script>

{#if href !== undefined}
	<!-- eslint-disable svelte/no-navigation-without-resolve --  -->
	<a
		class="button {variant}"
		class:busy
		href={disabled ? undefined : href}
		aria-disabled={disabled ? 'true' : undefined}
		aria-busy={busy ? 'true' : undefined}
		tabindex={disabled ? -1 : undefined}
	>
		{#if icon !== undefined}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span class="label">{@render children()}</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		class="button {variant}"
		class:busy
		{type}
		{name}
		{value}
		{formaction}
		{disabled}
		aria-busy={busy ? 'true' : undefined}
		aria-pressed={pressed}
	>
		{#if icon !== undefined}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
		<span class="label">{@render children()}</span>
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 44px;
		min-width: 44px;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
		font-family: var(--font-ui);
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-control);
		line-height: 1.2;
		text-decoration: none;
		/* El texto puede partirse en varias líneas: en 320 px un enlace largo no debe desbordar la página (UX, E2E de 320 px). */
		max-width: 100%;
		transition:
			background var(--duration-base) var(--ease-standard),
			box-shadow var(--duration-base) var(--ease-standard),
			transform var(--duration-base) var(--ease-standard);
	}

	.button:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.button[disabled],
	.button[aria-disabled='true'] {
		opacity: 0.5;
		pointer-events: none;
	}

	.button.busy {
		opacity: 0.8;
	}

	.primary {
		color: var(--color-button-primary-text);
		background: var(--gradient-button-primary);
		border: 1px solid var(--border-button-primary);
		box-shadow: var(--shadow-button-primary);
	}

	.primary:hover {
		background: var(--gradient-button-primary-hover);
		box-shadow: var(--shadow-button-primary-hover);
	}

	.secondary {
		color: var(--color-text-secondary);
		background: var(--surface-secondary);
		border: 1px solid var(--border-default);
		backdrop-filter: blur(var(--blur-card));
		-webkit-backdrop-filter: blur(var(--blur-card));
	}

	.secondary:hover {
		background: var(--surface-secondary-hover);
		border-color: var(--border-hover);
	}

	/* Sin soporte de backdrop-filter, el secundario se vuelve opaco (material de tarjeta). */
	@supports not (backdrop-filter: blur(1px)) {
		.secondary {
			background: var(--surface-solid-card);
		}
	}

	.ghost {
		color: var(--color-accent);
		background: transparent;
		border: 1px solid transparent;
		font-weight: var(--font-weight-subtitle);
	}

	.ghost:hover {
		color: var(--color-accent-hover);
	}

	.button:active:not([disabled]) {
		transform: scale(0.985);
	}

	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: none;
		}

		.button:active:not([disabled]) {
			transform: none;
		}
	}
</style>
