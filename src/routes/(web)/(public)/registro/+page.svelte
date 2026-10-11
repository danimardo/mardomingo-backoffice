<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
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
	const sentTo = $derived(formState.sentTo);

	let busy = $state(false);
	let email = $state('');
	let acceptTerms = $state(false);
	let acceptPrivacy = $state(false);
	let acceptAup = $state(false);
	let ageDeclaration = $state(false);

	const versionOf = (kind: string): string =>
		data.legal.find((item) => item.kind === kind)?.version ?? '';
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

	<ErrorSummary {errors} {formError} />

	<form
		method="POST"
		action="?/registrar"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
		novalidate
	>
		{#if data.originApp !== null}
			<input type="hidden" name="app" value={data.originApp.slug} />
		{/if}
		<input type="hidden" name="versionTerms" value={versionOf('terms')} />
		<input type="hidden" name="versionPrivacy" value={versionOf('privacy')} />
		<input type="hidden" name="versionAup" value={versionOf('aup')} />

		<TextField
			id="email"
			name="email"
			type="email"
			label={m.accounts_email_label()}
			autocomplete="email"
			required
			bind:value={email}
			error={errors.email ?? ''}
		/>

		<PasswordField
			id="password"
			name="password"
			label={m.accounts_password_label()}
			autocomplete="new-password"
			hint={m.accounts_password_rule({
				min: String(data.passwordRule.min),
				max: String(data.passwordRule.max)
			})}
			error={errors.password ?? ''}
		/>

		<fieldset>
			<legend>{m.accounts_legal_legend()}</legend>
			<Checkbox
				id="acceptTerms"
				name="acceptTerms"
				bind:checked={acceptTerms}
				error={errors.acceptTerms ?? ''}
			>
				{m.accounts_accept_terms({ version: versionOf('terms') })}
			</Checkbox>
			<Checkbox
				id="acceptPrivacy"
				name="acceptPrivacy"
				bind:checked={acceptPrivacy}
				error={errors.acceptPrivacy ?? ''}
			>
				{m.accounts_accept_privacy({ version: versionOf('privacy') })}
			</Checkbox>
			<Checkbox
				id="acceptAup"
				name="acceptAup"
				bind:checked={acceptAup}
				error={errors.acceptAup ?? ''}
			>
				{m.accounts_accept_aup({ version: versionOf('aup') })}
			</Checkbox>
			<Checkbox
				id="ageDeclaration"
				name="ageDeclaration"
				bind:checked={ageDeclaration}
				error={errors.ageDeclaration ?? ''}
			>
				{m.accounts_age_declaration({ age: String(data.minAge) })}
			</Checkbox>
		</fieldset>

		<noscript>
			<Notice tone="warning">
				<p>{m.accounts_captcha_noscript()}</p>
			</Notice>
		</noscript>
		{#if data.turnstileSiteKey !== ''}
			<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
		{/if}

		<Button type="submit" {busy}>
			{busy ? m.accounts_submit_busy() : m.accounts_register_submit()}
		</Button>
	</form>
	<Button variant="ghost" href={resolve('/login')}>{m.accounts_login_link()}</Button>
{/if}
