<script lang="ts">
	// W27 · `/panel/perfil`: email de la cuenta y cambio de contraseña con la actual (T266). Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
	const billingErrorText = $derived(billingMessageOf(form?.billingError ?? null));
	const thresholdText = $derived(
		data.threshold === null ? '' : String(data.threshold / 1_000_000).replace('.', ',')
	);

	function billingMessageOf(key: string | null) {
		switch (key) {
			case 'invoicing_kind_invalid':
				return m.invoicing_kind_invalid();
			case 'invoicing_legal_name_required':
				return m.invoicing_legal_name_required();
			case 'invoicing_tax_id_invalid':
				return m.invoicing_tax_id_invalid();
			case 'invoicing_address_required':
				return m.invoicing_address_required();
			case 'invoicing_postal_code_required':
				return m.invoicing_postal_code_required();
			case 'invoicing_city_required':
				return m.invoicing_city_required();
			case 'invoicing_country_invalid':
				return m.invoicing_country_invalid();
			default:
				return key === null ? '' : m.profile_billing_error();
		}
	}
</script>

<svelte:head>
	<title>{m.profile_title()}</title>
</svelte:head>

<h1>{m.profile_title()}</h1>

{#if data.passwordChanged}
	<Banner level="info">{m.profile_password_changed()}</Banner>
{/if}
{#if data.emailSent}
	<Banner level="info">{m.profile_email_sent()}</Banner>
{/if}
{#if data.exportFailed}
	<Banner level="critical">{m.profile_export_failed()}</Banner>
{/if}
{#if data.saved === 'threshold_saved'}
	<Banner level="info">{m.profile_threshold_saved()}</Banner>
{/if}
{#if data.saved === 'billing_saved'}
	<Banner level="info">{m.profile_billing_saved()}</Banner>
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

<section aria-labelledby="perfil-cambio-email">
	<h2 id="perfil-cambio-email">{m.profile_email_change_heading()}</h2>
	<p>{m.profile_email_change_intro()}</p>
	<form method="POST" action="?/cambiarEmail">
		<TextField
			id="perfil-nuevo-email"
			name="newEmail"
			label={m.profile_new_email()}
			autocomplete="email"
			error={errors.newEmail ?? ''}
		/>
		<PasswordField
			id="perfil-email-contrasena"
			name="currentPassword"
			label={m.profile_email_change_password()}
			autocomplete="current-password"
			error={errors.currentPassword ?? ''}
		/>
		<p><Button type="submit" variant="primary">{m.profile_email_change_submit()}</Button></p>
	</form>
</section>

<section aria-labelledby="perfil-aviso-saldo">
	<h2 id="perfil-aviso-saldo">{m.profile_alert_heading()}</h2>
	<form method="POST" action="?/guardarAvisoSaldo">
		<TextField
			id="perfil-umbral"
			name="threshold"
			label={m.profile_alert_label()}
			value={thresholdText}
			hint={m.profile_alert_hint()}
			error={errors.threshold ?? ''}
		/>
		<p><Button type="submit" variant="secondary">{m.profile_alert_submit()}</Button></p>
	</form>
</section>

<section aria-labelledby="perfil-datos-fiscales">
	<h2 id="perfil-datos-fiscales">{m.profile_billing_heading()}</h2>
	<p>{m.profile_billing_intro()}</p>
	{#if billingErrorText !== ''}
		<Banner level="critical">{billingErrorText}</Banner>
	{/if}
	<form method="POST" action="?/guardarDatosFiscales">
		<div class="campo">
			<label for="fiscal-tipo">{m.profile_billing_kind()}</label>
			<select id="fiscal-tipo" name="kind">
				<option
					value="individual"
					selected={(form?.billingValues?.kind ?? data.billing.kind) !== 'business'}
					>{m.profile_billing_individual()}</option
				>
				<option
					value="business"
					selected={(form?.billingValues?.kind ?? data.billing.kind) === 'business'}
					>{m.profile_billing_business()}</option
				>
			</select>
		</div>
		<TextField
			id="fiscal-nombre"
			name="legalName"
			label={m.profile_billing_legal_name()}
			value={form?.billingValues?.legalName ?? data.billing.legalName ?? ''}
		/>
		<TextField
			id="fiscal-nif"
			name="taxId"
			label={m.profile_billing_tax_id()}
			value={form?.billingValues?.taxId ?? data.billing.taxId ?? ''}
		/>
		<TextField
			id="fiscal-direccion"
			name="address"
			label={m.profile_billing_address()}
			value={form?.billingValues?.address ?? data.billing.address ?? ''}
		/>
		<TextField
			id="fiscal-cp"
			name="postalCode"
			label={m.profile_billing_postal_code()}
			value={form?.billingValues?.postalCode ?? data.billing.postalCode ?? ''}
		/>
		<TextField
			id="fiscal-ciudad"
			name="city"
			label={m.profile_billing_city()}
			value={form?.billingValues?.city ?? data.billing.city ?? ''}
		/>
		<TextField
			id="fiscal-pais"
			name="country"
			label={m.profile_billing_country()}
			value={form?.billingValues?.country ?? data.billing.country ?? 'ES'}
		/>
		<p><Button type="submit" variant="primary">{m.profile_billing_submit()}</Button></p>
	</form>
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

<section aria-labelledby="perfil-exportar">
	<h2 id="perfil-exportar">{m.profile_export_heading()}</h2>
	<p>{m.profile_export_intro()}</p>
	<p>
		<!-- Descarga de un fichero: se pide con un enlace normal y el servidor responde con `attachment`. -->
		<Button href={resolve('/panel/perfil/exportar')} download variant="secondary"
			>{m.profile_export_link()}</Button
		>
	</p>
</section>

<section aria-labelledby="perfil-borrar">
	<h2 id="perfil-borrar">{m.profile_delete_heading()}</h2>
	<p>{m.profile_delete_intro()}</p>
	<p>
		<Button href={resolve('/panel/perfil/borrar')} variant="ghost">{m.profile_delete_link()}</Button
		>
	</p>
</section>
