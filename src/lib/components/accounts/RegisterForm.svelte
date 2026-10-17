<script lang="ts">
	// Formulario de registro (W08; BE-FR-01; UX-01, UX-02). Envía a `?/registrar` por POST. El captcha de Turnstile va
	// dentro del formulario, para que su respuesta viaje con los demás campos; el script lo carga la página.
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { singleSubmit } from './submit';

	interface Props {
		/** Errores por campo, del resultado de la acción. */
		errors: Readonly<Record<string, string>>;
		/** Texto del error de negocio, o vacío. */
		formError: string;
		/** Slug de la app de origen (`?app=`), o `null`. Viaja como campo oculto. */
		originSlug: string | null;
		/** Versiones vigentes de los documentos legales, por tipo (`terms`, `privacy`, `aup`). */
		legal: readonly { readonly kind: string; readonly version: string }[];
		minAge: number;
		passwordRule: { readonly min: number; readonly max: number };
		/** Clave pública de Turnstile; vacía cuando el captcha no se carga (pruebas). */
		turnstileSiteKey: string;
	}

	let { errors, formError, originSlug, legal, minAge, passwordRule, turnstileSiteKey }: Props =
		$props();

	let busy = $state(false);
	const submit = singleSubmit((value) => {
		busy = value;
	});

	const versionOf = (kind: string): string =>
		legal.find((item) => item.kind === kind)?.version ?? '';
</script>

<ErrorSummary {errors} {formError} />

<form method="POST" action="?/registrar" use:enhance={submit} novalidate>
	{#if originSlug !== null}
		<input type="hidden" name="app" value={originSlug} />
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
		error={errors.email ?? ''}
	/>

	<PasswordField
		id="password"
		name="password"
		label={m.accounts_password_label()}
		autocomplete="new-password"
		hint={m.accounts_password_rule({
			min: String(passwordRule.min),
			max: String(passwordRule.max)
		})}
		error={errors.password ?? ''}
	/>

	<fieldset>
		<legend>{m.accounts_legal_legend()}</legend>
		<Checkbox id="acceptTerms" name="acceptTerms" error={errors.acceptTerms ?? ''}>
			{m.accounts_accept_terms({ version: versionOf('terms') })}
		</Checkbox>
		<Checkbox id="acceptPrivacy" name="acceptPrivacy" error={errors.acceptPrivacy ?? ''}>
			{m.accounts_accept_privacy({ version: versionOf('privacy') })}
		</Checkbox>
		<Checkbox id="acceptAup" name="acceptAup" error={errors.acceptAup ?? ''}>
			{m.accounts_accept_aup({ version: versionOf('aup') })}
		</Checkbox>
		<Checkbox id="ageDeclaration" name="ageDeclaration" error={errors.ageDeclaration ?? ''}>
			{m.accounts_age_declaration({ age: String(minAge) })}
		</Checkbox>
	</fieldset>

	<noscript>
		<Notice tone="warning">
			<p>{m.accounts_captcha_noscript()}</p>
		</Notice>
	</noscript>
	{#if turnstileSiteKey !== ''}
		<div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
	{/if}

	<Button type="submit" {busy}>
		{busy ? m.accounts_submit_busy() : m.accounts_register_submit()}
	</Button>
</form>
