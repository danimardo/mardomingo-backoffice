<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const formError = $derived(formState.formError);
	let busy = $state(false);
</script>

<svelte:head>
	<title>{m.accounts_verify_title()}</title>
</svelte:head>

<h1>{m.accounts_verify_title()}</h1>

{#if data.tokenState === 'valid'}
	<p>{m.accounts_verify_intro()}</p>
	<ErrorSummary errors={{}} {formError} />
	<form
		method="POST"
		action="?/verificar"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="token" value={data.token} />
		<Button type="submit" {busy}>
			{busy ? m.accounts_submit_busy() : m.accounts_verify_action()}
		</Button>
	</form>
{:else}
	<Notice tone="warning">
		<p>
			{#if data.tokenState === 'used'}
				{m.accounts_verify_used()}
			{:else}
				{m.accounts_verify_invalid()}
			{/if}
		</p>
		<p><a href={resolve('/verificar/reenviar')}>{m.accounts_verify_resend_link()}</a></p>
	</Notice>
{/if}
