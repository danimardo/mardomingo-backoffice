<script lang="ts">
	/** CardBody — el contenido principal. Ver `Card.svelte` para el criterio de padding. */
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { class: className = "", style: styleProp = "", children }: Props = $props();
</script>

<div class="gg-card-body {className}" style={styleProp}>
	{@render children?.()}
</div>

<style>
	.gg-card-body {
		box-sizing: border-box;
		padding: var(--space-5);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}
</style>
