<script lang="ts">
	import { resolve } from '$app/paths';
	import Notice from '$lib/components/ui/Notice.svelte';
	import ResetForm from '$lib/components/accounts/ResetForm.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
</script>

<svelte:head>
	<title>{m.accounts_newpass_title()}</title>
</svelte:head>

<h1>{m.accounts_newpass_title()}</h1>

{#if data.tokenState === 'valid'}
	<ResetForm
		mode="confirm"
		errors={formState.errors}
		formError={formState.formError}
		token={data.token}
		passwordRule={data.passwordRule}
	/>
{:else}
	<Notice tone="warning">
		<p>{data.tokenState === 'used' ? m.accounts_newpass_used() : m.accounts_newpass_invalid()}</p>
		<p><a href={resolve('/recuperar')}>{m.accounts_newpass_request_link()}</a></p>
	</Notice>
{/if}
