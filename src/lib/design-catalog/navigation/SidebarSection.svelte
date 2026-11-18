<script lang="ts">
	/**
	 * SidebarSection — agrupa `SidebarItem`s bajo un título. En modo
	 * colapsado el título se oculta VISUALMENTE (sigue en el DOM para
	 * lector de pantalla) — es un compromiso deliberado del modo icono:
	 * quien navega solo con el rótulo lo pierde a cambio de más espacio,
	 * quien usa lector de pantalla no pierde nada.
	 */
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";
	import type { SidebarContext } from "./Sidebar.svelte";

	interface Props {
		title?: string;
		class?: string;
		children: Snippet;
	}

	let { title, class: className = "", children }: Props = $props();
	const ctx = getContext<SidebarContext>("gg-sidebar");
</script>

<div class="gg-sidebar-section {className}">
	{#if title}
		<p class="gg-sidebar-section__title" class:gg-sidebar-section__title--hidden={ctx?.collapsed}>
			{title}
		</p>
	{/if}
	<div class="gg-sidebar-section__items">
		{@render children()}
	</div>
</div>

<style>
	.gg-sidebar-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-sidebar-section__title {
		margin: 0;
		padding: var(--space-2) var(--space-2) 0;
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-overline-weight);
		line-height: var(--text-overline-leading);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.gg-sidebar-section__title--hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.gg-sidebar-section__items {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
</style>
