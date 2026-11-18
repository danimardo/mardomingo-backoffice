<script lang="ts">
	/**
	 * MegaMenuSection (ampliación 3) — una COLUMNA con encabezado dentro
	 * de `MegaMenu`. El encabezado es texto NO interactivo (no
	 * `role="menuitem"`, no entra en el roving tabindex de `Menu`) — solo
	 * agrupa visualmente los `MenuItem` que van debajo, mismo criterio
	 * que un `<h3>` de sección normal.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		heading: string;
		class?: string;
		children: Snippet;
	}

	let { heading, class: className = "", children }: Props = $props();
</script>

<div class="gg-mega-menu-section {className}">
	<p class="gg-mega-menu-section__heading">{heading}</p>
	{@render children()}
</div>

<style>
	.gg-mega-menu-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.gg-mega-menu-section__heading {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-overline-weight);
		line-height: var(--text-overline-leading);
		text-transform: uppercase;
	}
</style>
