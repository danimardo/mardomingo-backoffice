<script lang="ts">
	/**
	 * MenuGroup — agrupa `MenuItem`s relacionados con `role="group"`. La
	 * etiqueta es opcional y, cuando se da, se referencia con
	 * `aria-labelledby` en vez de `aria-label` para que el texto visible
	 * y el nombre accesible del grupo sean literalmente el mismo nodo.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		label?: string;
		class?: string;
		children: Snippet;
	}

	let { label, class: className = "", children }: Props = $props();
	const uid = $props.id();
	const labelId = `${uid}-menu-group-label`;
</script>

<div role="group" aria-labelledby={label ? labelId : undefined} class="gg-menu-group {className}">
	{#if label}
		<p id={labelId} class="gg-menu-group__label">{label}</p>
	{/if}
	{@render children()}
</div>

<style>
	.gg-menu-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-menu-group__label {
		margin: 0;
		padding: var(--space-2) var(--space-3) 0;
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-overline-weight);
		line-height: var(--text-overline-leading);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
</style>
