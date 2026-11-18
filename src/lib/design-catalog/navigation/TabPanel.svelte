<script lang="ts">
	/**
	 * TabPanel — hijo de `<Tabs>`; lee la pestaña activa por contexto de
	 * Svelte (`getContext("gg-tabs")`) en vez de que el consumidor tenga
	 * que pasarle `active`/ids a mano. Solo se renderiza cuando su
	 * `value` coincide con la pestaña activa.
	 */
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";
	import type { TabsContext } from "./Tabs.svelte";

	interface Props {
		value: string;
		class?: string;
		children?: Snippet;
	}

	let { value, class: className = "", children }: Props = $props();

	const ctx = getContext<TabsContext>("gg-tabs");
	if (!ctx) {
		throw new Error("<TabPanel> debe usarse dentro de <Tabs>.");
	}
</script>

{#if ctx.value === value}
	<div role="tabpanel" id={ctx.panelId(value)} aria-labelledby={ctx.tabId(value)} tabindex="0" class="gg-tab-panel {className}">
		{@render children?.()}
	</div>
{/if}

<style>
	.gg-tab-panel {
		padding-top: var(--space-4);
	}

	.gg-tab-panel:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
		border-radius: var(--radius-xs);
	}
</style>
