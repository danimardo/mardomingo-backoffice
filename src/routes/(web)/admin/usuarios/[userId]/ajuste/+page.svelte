<script lang="ts">
	// W36 · `/admin/usuarios/[userId]/ajuste`: ajuste de saldo con vista previa y confirmación (T307; BE-FR-18, D-16). La vista previa no
	// cambia nada; ajustarSaldo exige la casilla de confirmación. Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { formatCredits } from '$lib/components/payments/format';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	// La página se recarga entera tras cada acción: se vuelven a pintar los valores enviados para no pedirlos otra vez.
	const values = $derived<Readonly<Record<string, string>>>(
		form && 'values' in form ? form.values : { tipo: 'credit', bolsa: 'free' }
	);
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
</script>

<svelte:head>
	<title>{m.admin_adjust_title()}</title>
</svelte:head>

<h1>{m.admin_adjust_title()}</h1>
<p>{data.account.email}</p>
<p>
	{m.admin_account_balance_total()}: {formatCredits(data.balance.totalMicro)} ·
	{m.admin_account_balance_debt()}: {formatCredits(data.balance.debtMicro)}
</p>
<p>{m.admin_adjust_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_adjust_error()}</Banner>
{/if}

{#if form?.preview}
	<section aria-labelledby="vista-previa">
		<h2 id="vista-previa">{m.admin_adjust_preview_submit()}</h2>
		<dl>
			<dt>{m.admin_adjust_before()}</dt>
			<dd>{formatCredits(form.preview.balanceBeforeMicro)}</dd>
			<dt>{m.admin_adjust_after()}</dt>
			<dd>{formatCredits(form.preview.balanceAfterMicro)}</dd>
			<dt>{m.admin_adjust_debt_settled()}</dt>
			<dd>{formatCredits(form.preview.debtSettledMicro)}</dd>
		</dl>
	</section>
{/if}

<form method="POST">
	<input type="hidden" name="clave" value={data.adjustmentKey} />
	<TextField
		id="cantidad"
		name="cantidad"
		value={values.cantidad ?? ''}
		label={m.admin_adjust_amount()}
		error={errors.amountCredits ?? ''}
		required
	/>
	<Select
		id="tipo"
		name="tipo"
		value={values.tipo ?? 'credit'}
		label={m.admin_adjust_type()}
		options={[
			{ value: 'credit', label: m.admin_adjust_credit() },
			{ value: 'debit', label: m.admin_adjust_debit() }
		]}
	/>
	<Select
		id="bolsa"
		name="bolsa"
		value={values.bolsa ?? 'free'}
		label={m.admin_adjust_kind()}
		options={[
			{ value: 'free', label: m.admin_adjust_free() },
			{ value: 'paid', label: m.admin_adjust_paid() }
		]}
	/>
	<TextField
		id="vence"
		name="vence"
		value={values.vence ?? ''}
		label={m.admin_adjust_expires()}
		hint="AAAA-MM-DD"
		error={errors.vence ?? ''}
	/>
	<TextField
		id="motivo"
		name="motivo"
		value={values.motivo ?? ''}
		label={m.admin_adjust_reason()}
		error={errors.motivo ?? ''}
		required
	/>
	<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_adjust_confirm()}</Checkbox>
	<p>
		<Button type="submit" formaction="?/previsualizarAjuste" variant="secondary"
			>{m.admin_adjust_preview_submit()}</Button
		>
		<Button type="submit" formaction="?/ajustarSaldo" variant="primary"
			>{m.admin_adjust_apply_submit()}</Button
		>
	</p>
</form>
