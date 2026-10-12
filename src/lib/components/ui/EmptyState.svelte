<script lang="ts">
	// Estado vacío (DS-06; T255). Distingue «todavía no hay datos» de «ningún resultado con este filtro», y el segundo muestra el
	// filtro activo para que el usuario sepa por qué no ve nada.
	import * as m from '$lib/paraglide/messages.js';

	let { variant, filter = '' }: { variant: 'empty' | 'no-match'; filter?: string } = $props();
</script>

<section class="empty" aria-live="polite">
	{#if variant === 'no-match'}
		<h2>{m.empty_no_match_title()}</h2>
		<p>{m.empty_no_match_body({ filter })}</p>
	{:else}
		<h2>{m.empty_title()}</h2>
		<p>{m.empty_body()}</p>
	{/if}
</section>

<style>
	.empty {
		padding: 1rem 0;
		color: var(--color-text-secondary);
	}
</style>
