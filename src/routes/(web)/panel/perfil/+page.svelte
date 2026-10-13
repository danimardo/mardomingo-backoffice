<script lang="ts">
	// W27 · `/panel/perfil`: email de la cuenta y cambio de contraseña con la actual (T266). Sin JavaScript funciona igual.
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
</script>

<svelte:head>
	<title>{m.profile_title()}</title>
</svelte:head>

<h1>{m.profile_title()}</h1>

{#if data.passwordChanged}
	<Banner level="info">{m.profile_password_changed()}</Banner>
{/if}

<section aria-labelledby="perfil-cuenta">
	<h2 id="perfil-cuenta">{m.profile_account_heading()}</h2>
	<TextField
		id="perfil-email"
		name="email"
		label={m.profile_email_label()}
		value={data.email}
		autocomplete="email"
		hint={m.profile_email_hint()}
		disabled
	/>
</section>

<section aria-labelledby="perfil-contrasena">
	<h2 id="perfil-contrasena">{m.profile_password_heading()}</h2>
	<form method="POST" action="?/cambiarContrasena">
		<PasswordField
			id="perfil-actual"
			name="currentPassword"
			label={m.profile_current_password()}
			autocomplete="current-password"
			error={errors.currentPassword ?? ''}
		/>
		<PasswordField
			id="perfil-nueva"
			name="newPassword"
			label={m.profile_new_password()}
			autocomplete="new-password"
			error={errors.newPassword ?? ''}
		/>
		<PasswordField
			id="perfil-repite"
			name="confirmation"
			label={m.profile_repeat_password()}
			autocomplete="new-password"
			error={errors.confirmation ?? ''}
		/>
		<p><Button type="submit" variant="primary">{m.profile_password_submit()}</Button></p>
	</form>
</section>
