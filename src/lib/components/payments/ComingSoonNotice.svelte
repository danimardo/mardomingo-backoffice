<script lang="ts">
	// «Próximamente» de la compra (UX-06): explicación visible y enfocable, no solo un botón desactivado.
	import * as m from '$lib/paraglide/messages.js';
	import Notice from '$lib/components/ui/Notice.svelte';
</script>

<div tabindex="-1" class="coming-soon">
	<Notice tone="info">
		<h2>{m.payments_coming_soon_title()}</h2>
		<p>{m.payments_coming_soon_body()}</p>
	</Notice>
</div>

<style>
	.coming-soon:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
</style>
