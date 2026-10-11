<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import RegisterForm from '$lib/components/accounts/RegisterForm.svelte';
	import { formStateOf } from '$lib/components/accounts/form-state';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const formState = $derived(formStateOf(form));
	const sentTo = $derived(formState.sentTo);
</script>

<svelte:head>
	<title>{m.accounts_register_title()}</title>
	{#if data.turnstileSiteKey !== ''}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<h1>{m.accounts_register_title()}</h1>

{#if sentTo !== null}
	<Notice tone="success">
		<h2>{m.accounts_sent_title()}</h2>
		<p>{m.accounts_sent_body({ email: sentTo })}</p>
		<p>{m.accounts_sent_no_arrive()}</p>
		<p><a href={resolve('/verificar/reenviar')}>{m.accounts_sent_resend()}</a></p>
	</Notice>
{:else}
	<p>{m.accounts_register_intro()}</p>
	{#if data.originApp !== null}
		<p>{m.accounts_app_origin({ app: data.originApp.name })}</p>
	{/if}

	<RegisterForm
		errors={formState.errors}
		formError={formState.formError}
		originSlug={data.originApp?.slug ?? null}
		legal={data.legal}
		minAge={data.minAge}
		passwordRule={data.passwordRule}
		turnstileSiteKey={data.turnstileSiteKey}
	/>
	<Button variant="ghost" href={resolve('/login')}>{m.accounts_login_link()}</Button>
{/if}
