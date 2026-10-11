<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const errors = $derived(formState.errors);
	const formError = $derived(formState.formError);
	const sent = $derived(formState.success);
	let busy = $state(false);
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
	<ErrorSummary {errors} {formError} />
	<form
		method="POST"
		action="?/solicitar"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<TextField
			id="email"
			name="email"
			type="email"
			label={m.accounts_email_label()}
			autocomplete="email"
			required
			error={errors.email ?? ''}
		/>
		<Button type="submit" {busy}
			>{busy ? m.accounts_submit_busy() : m.accounts_reset_action()}</Button
		>
	</form>
{/if}
