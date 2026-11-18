<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		id?: string;
		class?: string;
		children: Snippet;
	}

	let { id, class: className = "", children }: Props = $props();
</script>

<p {id} class="gg-form-description {className}">
	{@render children()}
</p>

<style>
	.gg-form-description {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		color: var(--text-secondary);
	}
</style>
