<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let busy = $state(false);
</script>

<svelte:head>
	<title>{m.accounts_logout_title()}</title>
</svelte:head>

<h1>{m.accounts_logout_title()}</h1>
<p>{m.accounts_logout_intro({ email: data.email })}</p>
<form
	method="POST"
	action="?/salir"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			busy = false;
			await update();
		};
	}}
>
	<Button type="submit" {busy}
		>{busy ? m.accounts_submit_busy() : m.accounts_logout_action()}</Button
	>
</form>
