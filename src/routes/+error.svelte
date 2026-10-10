<script lang="ts">
	// Página de error (FR-113; contracts/web-routes.md 1.8): texto según el estado, código de referencia y una salida.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages.js';

	const title = $derived(
		page.status === 404
			? m.error_not_found_title()
			: page.status === 403
				? m.error_forbidden_title()
				: m.error_unexpected_title()
	);
	const requestId = $derived(page.error?.requestId ?? '');
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<h1>{title}</h1>
{#if requestId !== ''}
	<p>{m.errors_reference_code()}: <code>{requestId}</code></p>
{/if}
<Button href={resolve('/')} variant="primary">{m.error_go_home()}</Button>
