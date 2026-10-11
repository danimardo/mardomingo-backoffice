<script lang="ts">
	// Resumen de errores de un formulario (UX-01): cada error enlaza con su campo; al mostrarse toma el foco y se anuncia.
	import { tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Errores por nombre de campo (`_form` para los generales). */
		errors: Readonly<Record<string, string>>;
		formError?: string;
	}

	let { errors, formError = '' }: Props = $props();
	let summary = $state<HTMLElement | undefined>(undefined);
	const entries = $derived(Object.entries(errors).filter(([field]) => field !== '_form'));
	const visible = $derived(entries.length > 0 || formError !== '');

	$effect(() => {
		if (visible) {
			void tick().then(() => summary?.focus());
		}
	});
</script>

{#if visible}
	<div class="summary" role="alert" tabindex="-1" bind:this={summary}>
		<p><strong>{m.errors_summary_title()}</strong></p>
		{#if formError !== ''}
			<p>{formError}</p>
		{/if}
		{#if entries.length > 0}
			<ul>
				{#each entries as [field, message] (field)}
					<li><a href="#{field}">{message}</a></li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.summary {
		border: 2px solid var(--color-danger);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		color: var(--color-text-primary);
		background: var(--color-danger-soft);
	}
	.summary:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
