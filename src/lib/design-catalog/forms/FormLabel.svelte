<script lang="ts">
	import type { Snippet } from "svelte";
	import RequiredIndicator from "./RequiredIndicator.svelte";

	interface Props {
		for: string;
		required?: boolean;
		class?: string;
		children: Snippet;
	}

	let { for: htmlFor, required = false, class: className = "", children }: Props = $props();
</script>

<label for={htmlFor} class="gg-form-label {className}">
	{@render children()}
	{#if required}
		<RequiredIndicator />
	{/if}
</label>

<style>
	.gg-form-label {
		display: inline-block;
		font-family: var(--font-sans);
		font-size: var(--text-label-size);
		line-height: var(--text-label-leading);
		font-weight: var(--text-label-weight);
		color: var(--text-primary);
	}

</style>
