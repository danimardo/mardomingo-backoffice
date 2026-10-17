<script lang="ts">
	import { resolve } from '$app/paths';
	import LoginForm from '$lib/components/accounts/LoginForm.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const code = $derived(formState.code);
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

<LoginForm errors={formState.errors} formError={formState.formError} redirectTo={data.redirectTo} />

<ul>
	<li><a href={resolve('/recuperar')}>{m.accounts_login_forgot()}</a></li>
	<li><a href={resolve('/registro')}>{m.accounts_login_register()}</a></li>
	{#if code === 'EMAIL_NOT_VERIFIED'}
		<li><a href={resolve('/verificar/reenviar')}>{m.accounts_login_resend_link()}</a></li>
	{/if}
</ul>
