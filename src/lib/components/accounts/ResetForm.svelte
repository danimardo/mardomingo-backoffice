<script lang="ts">
	// Formulario de recuperación de la contraseña (BE-FR-05; UX-01). Con `mode="request"` pide el enlace (W12, acción
	// `?/solicitar`); con `mode="confirm"` fija la nueva contraseña con el token del enlace (W13, acción
	// `?/restablecer`). El token viaja en un campo oculto y la acción lo consume una sola vez.
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { singleSubmit } from './submit';

	type PasswordRule = { readonly min: number; readonly max: number };
	type Props = {
		/** Errores por campo, del resultado de la acción. */
		errors: Readonly<Record<string, string>>;
		/** Texto del error de negocio, o vacío. */
		formError: string;
	} & ({ mode: 'request' } | { mode: 'confirm'; token: string; passwordRule: PasswordRule });

	const props: Props = $props();

	let busy = $state(false);
	const submit = singleSubmit((value) => {
		busy = value;
	});
</script>

<ErrorSummary errors={props.errors} formError={props.formError} />

{#if props.mode === 'request'}
	<form method="POST" action="?/solicitar" use:enhance={submit}>
		<TextField
			id="email"
			name="email"
			type="email"
			label={m.accounts_email_label()}
			autocomplete="email"
			required
			error={props.errors.email ?? ''}
		/>
		<Button type="submit" {busy}>
			{busy ? m.accounts_submit_busy() : m.accounts_reset_action()}
		</Button>
	</form>
{:else}
	<form method="POST" action="?/restablecer" use:enhance={submit}>
		<input type="hidden" name="token" value={props.token} />
		<PasswordField
			id="password"
			name="password"
			label={m.accounts_password_new()}
			autocomplete="new-password"
			hint={m.accounts_password_rule({
				min: String(props.passwordRule.min),
				max: String(props.passwordRule.max)
			})}
			error={props.errors.password ?? ''}
		/>
		<Button type="submit" {busy}>
			{busy ? m.accounts_submit_busy() : m.accounts_newpass_action()}
		</Button>
	</form>
{/if}
