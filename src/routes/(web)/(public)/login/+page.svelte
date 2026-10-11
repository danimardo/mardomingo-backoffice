<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const errors = $derived(formState.errors);
	const formError = $derived(formState.formError);
	const code = $derived(formState.code);
	let busy = $state(false);
	const noticeText = $derived(
		data.notice === 'password_reset'
			? m.accounts_login_notice_password_reset()
			: data.notice === 'logged_out'
				? m.accounts_login_notice_logged_out()
				: data.notice === 'email_changed'
					? m.accounts_login_notice_email_changed()
					: data.notice === 'session_expired'
						? m.accounts_login_notice_session_expired()
						: ''
	);
</script>

<svelte:head>
	<title>{m.accounts_login_title()}</title>
</svelte:head>

<h1>{m.accounts_login_title()}</h1>

{#if noticeText !== ''}
	<Notice tone="info"><p>{noticeText}</p></Notice>
{/if}

<ErrorSummary {errors} {formError} />

<form
	method="POST"
	action="?/entrar"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			busy = false;
			await update({ reset: false });
		};
	}}
>
	<input type="hidden" name="redirectTo" value={data.redirectTo} />
	<TextField
		id="email"
		name="email"
		type="email"
		label={m.accounts_email_label()}
		autocomplete="email"
		required
		error={errors.email ?? ''}
	/>
	<PasswordField
		id="password"
		name="password"
		label={m.accounts_password_current()}
		autocomplete="current-password"
		error={errors.password ?? ''}
	/>
	<Button type="submit" {busy}>{busy ? m.accounts_submit_busy() : m.accounts_login_action()}</Button
	>
</form>

<ul>
	<li><a href={resolve('/recuperar')}>{m.accounts_login_forgot()}</a></li>
	<li><a href={resolve('/registro')}>{m.accounts_login_register()}</a></li>
	{#if code === 'EMAIL_NOT_VERIFIED'}
		<li><a href={resolve('/verificar/reenviar')}>{m.accounts_login_resend_link()}</a></li>
	{/if}
</ul>
