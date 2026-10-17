<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);

	const result = $derived(form && 'result' in form ? form.result : null);
</script>

<svelte:head>
	<title>{m.email_confirm_title()}</title>
</svelte:head>

<h1>{m.email_confirm_title()}</h1>

{#if result?.outcome === 'applied'}
	<Notice tone="success">
		<p>{m.email_confirm_applied({ count: String(result.sessionsClosed) })}</p>
		<p><a href={resolve('/login')}>{m.email_confirm_login()}</a></p>
	</Notice>
{:else if result !== null}
	<Notice tone="warning">
		<p>
			{#if result.outcome === 'expired'}
				{m.email_confirm_expired()}
			{:else if result.outcome === 'taken'}
				{m.email_confirm_taken()}
			{:else}
				{m.email_confirm_invalid()}
			{/if}
		</p>
		<p><a href={resolve('/panel/perfil')}>{m.email_confirm_request_again()}</a></p>
	</Notice>
{:else if data.token === ''}
	<Notice tone="warning">
		<p>{m.email_confirm_invalid()}</p>
	</Notice>
{:else}
	<p>{m.email_confirm_intro()}</p>
	<form
		method="POST"
		action="?/confirmar"
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
			{busy ? m.accounts_submit_busy() : m.email_confirm_action()}
		</Button>
	</form>
{/if}
