<script lang="ts">
	/**
	 * BottomNavigationItem — icono + etiqueta corta apiladas. Altura
	 * mínima de `--space-12` (48px) para el objetivo táctil — por encima
	 * del mínimo de 24px de WCAG 2.2 (2.5.8) y en línea con la práctica
	 * habitual de 44-48px en barras de navegación móviles.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		icon: Snippet;
		href?: string;
		active?: boolean;
		class?: string;
		onclick?: (e: MouseEvent) => void;
	}

	let { label, icon, href, active = false, class: className = "", onclick }: Props = $props();
</script>

{#snippet content()}
	<span class="gg-bottom-nav-item__icon" aria-hidden="true">{@render icon()}</span>
	<span class="gg-bottom-nav-item__label">{label}</span>
{/snippet}

{#if href}
	<a {href} aria-current={active ? "page" : undefined} class="gg-bottom-nav-item bc-pressable {className}" class:gg-bottom-nav-item--active={active}>
		{@render content()}
	</a>
{:else}
	<button
		type="button"
		aria-pressed={active}
		class="gg-bottom-nav-item bc-pressable {className}"
		class:gg-bottom-nav-item--active={active}
		{onclick}
	>
		{@render content()}
	</button>
{/if}

<style>
	.gg-bottom-nav-item {
		box-sizing: border-box;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-height: var(--space-12);
		padding: var(--space-1) var(--space-2);
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-family: var(--font-sans);
		text-decoration: none;
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-bottom-nav-item:hover {
		color: var(--text-secondary);
	}

	.gg-bottom-nav-item--active {
		color: var(--interactive-primary);
		/* v1.9.0 — trazo naranja de «dónde estás» en el borde superior. */
		box-shadow: inset 0 var(--indicator-thickness) 0 var(--indicator-accent);
	}

	.gg-bottom-nav-item:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-bottom-nav-item__icon {
		display: inline-flex;
		width: var(--space-6);
		height: var(--space-6);
	}

	.gg-bottom-nav-item__label {
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		font-weight: var(--text-label-weight);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-bottom-nav-item {
			transition: none;
		}
	}
</style>
