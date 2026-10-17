<script lang="ts">
	// Formulario de borrado de cuenta (W29; BE-FR-07; UX-07). Dice con claridad qué se pierde (saldo en créditos y en euros, sin
	// reembolso), a qué afecta (todas las apps) y pide la contraseña y una casilla nunca premarcada. El foco inicial no está en
	// «Borrar mi cuenta»: solo lo toma el resumen de errores, si lo hay. No pide nada más que lo que pide BE-FR-07.
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ErrorSummary from '$lib/components/ui/ErrorSummary.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import PasswordField from '$lib/components/ui/PasswordField.svelte';
	import { singleSubmit } from '$lib/components/accounts/submit';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		/** Saldo que se pierde, en micro-créditos (bolsas con saldo; la deuda no cuenta). */
		lossMicro: number;
		/** Su equivalencia en céntimos de euro, o nulo si no hay paquetes a la venta. */
		lossEurCents: number | null;
		/** Nombres de las apps que la cuenta ha usado. */
		apps: readonly string[];
		/** Errores por campo, del resultado de la acción. */
		errors: Readonly<Record<string, string>>;
		/** Texto del error de negocio, o vacío. */
		formError: string;
		/** Ruta del perfil, ya resuelta, para el enlace de volver. */
		profileHref: string;
	}

	let { lossMicro, lossEurCents, apps, errors, formError, profileHref }: Props = $props();

	let busy = $state(false);
	const submit = singleSubmit((value) => {
		busy = value;
	});
</script>

<ErrorSummary {errors} {formError} />

<Notice tone="warning">
	<p>{m.privacy_delete_all_apps()}</p>
	<p>
		{#if lossMicro > 0}
			{m.privacy_delete_loss({
				credits: formatCredits(lossMicro),
				eur: lossEurCents === null ? '—' : formatEuros(lossEurCents)
			})}
		{:else}
			{m.privacy_delete_no_loss()}
		{/if}
	</p>
</Notice>

<section aria-labelledby="borrar-apps">
	<h2 id="borrar-apps">{m.privacy_delete_apps_heading()}</h2>
	{#if apps.length > 0}
		<ul>
			{#each apps as name (name)}
				<li>{name}</li>
			{/each}
		</ul>
	{:else}
		<p>{m.privacy_delete_apps_none()}</p>
	{/if}
</section>

<form method="POST" action="?/borrarCuenta" use:enhance={submit}>
	<PasswordField
		id="password"
		name="password"
		label={m.privacy_delete_password()}
		autocomplete="current-password"
		error={errors.password ?? ''}
	/>
	<Checkbox id="confirmLoss" name="confirmLoss" error={errors.confirmLoss ?? ''}>
		{m.privacy_delete_confirm()}
	</Checkbox>
	<p>
		<Button type="submit" variant="primary" {busy}>{m.privacy_delete_submit()}</Button>
		<Button href={profileHref} variant="ghost">{m.privacy_delete_cancel()}</Button>
	</p>
</form>
