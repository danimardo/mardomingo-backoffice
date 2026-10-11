<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const errors = $derived(formState.errors);
	const formError = $derived(formState.formError);
	let busy = $state(false);
</script>

<svelte:head>
	<title>{m.accounts_newpass_title()}</title>
</svelte:head>

<h1>{m.accounts_newpass_title()}</h1>

{#if data.tokenState === 'valid'}
	<ErrorSummary {errors} {formError} />
	<form
		method="POST"
		action="?/restablecer"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<input type="hidden" name="token" value={data.token} />
		<PasswordField
			id="password"
			name="password"
			label={m.accounts_password_new()}
			autocomplete="new-password"
			hint={m.accounts_password_rule({
				min: String(data.passwordRule.min),
				max: String(data.passwordRule.max)
			})}
			error={errors.password ?? ''}
		/>
		<Button type="submit" {busy}
			>{busy ? m.accounts_submit_busy() : m.accounts_newpass_action()}</Button
		>
	</form>
{:else}
	<Notice tone="warning">
		<p>{data.tokenState === 'used' ? m.accounts_newpass_used() : m.accounts_newpass_invalid()}</p>
		<p><a href={resolve('/recuperar')}>{m.accounts_newpass_request_link()}</a></p>
	</Notice>
{/if}
