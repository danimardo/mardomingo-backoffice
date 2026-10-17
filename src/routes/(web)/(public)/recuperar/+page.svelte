<script lang="ts">
	import Notice from '$lib/components/ui/Notice.svelte';
	import ResetForm from '$lib/components/accounts/ResetForm.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const sent = $derived(formState.success);
</script>

<svelte:head>
	<title>{m.accounts_reset_title()}</title>
</svelte:head>

<h1>{m.accounts_reset_title()}</h1>

{#if sent}
	<Notice tone="success">
		<p>{m.accounts_reset_sent()}</p>
		<p>{m.accounts_reset_no_arrive()}</p>
	</Notice>
{:else}
	<p>{m.accounts_reset_intro()}</p>
	<ResetForm mode="request" errors={formState.errors} formError={formState.formError} />
{/if}
