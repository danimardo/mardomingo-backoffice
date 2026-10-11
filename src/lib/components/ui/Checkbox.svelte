<script lang="ts">
	// Casilla obligatoria o no: nunca premarcada. La etiqueta es el texto de la casilla (con sus enlaces, si los tiene).
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		name: string;
		checked?: boolean;
		error?: string;
		required?: boolean;
		children: Snippet;
	}

	let {
		id,
		name,
		checked = $bindable(false),
		error = '',
		required = false,
		children
	}: Props = $props();
</script>

<div class="checkbox">
	<input
		{id}
		{name}
		type="checkbox"
		bind:checked
		{required}
		aria-invalid={error !== '' ? 'true' : undefined}
		aria-describedby={error !== '' ? `${id}-error` : undefined}
	/>
	<label for={id}>{@render children()}</label>
	{#if error !== ''}
		<p id="{id}-error" class="error">{error}</p>
	{/if}
</div>

<style>
	.checkbox {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.5rem;
		align-items: start;
	}
	input {
		min-width: 1.25rem;
		min-height: 1.25rem;
		margin-top: 0.15rem;
	}
	.error {
		grid-column: 2;
		margin: 0;
		color: var(--color-danger);
	}
</style>
