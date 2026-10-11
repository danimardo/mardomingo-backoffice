<script lang="ts">
	// Formulario de entrar (W11; BE-FR-03; UX-01). Envía a `?/entrar` por POST. Los enlaces de ayuda que dependen del
	// resultado (p. ej. reenviar la verificación) quedan en la página, fuera del formulario.
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { singleSubmit } from './submit';

	interface Props {
		/** Errores por campo, del resultado de la acción. */
		errors: Readonly<Record<string, string>>;
		/** Texto del error de negocio, o vacío. */
		formError: string;
		/** Página a la que volver tras entrar, ya saneada en el servidor. */
		redirectTo: string;
	}

	let { errors, formError, redirectTo }: Props = $props();

	let busy = $state(false);
	const submit = singleSubmit((value) => {
		busy = value;
	});
</script>

<ErrorSummary {errors} {formError} />

<form method="POST" action="?/entrar" use:enhance={submit}>
	<input type="hidden" name="redirectTo" value={redirectTo} />
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
	<Button type="submit" {busy}>
		{busy ? m.accounts_submit_busy() : m.accounts_login_action()}
	</Button>
</form>
