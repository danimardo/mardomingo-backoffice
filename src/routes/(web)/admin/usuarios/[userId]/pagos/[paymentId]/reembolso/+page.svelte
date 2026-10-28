<script lang="ts">
	// W37 · reembolso de una compra (T308; BE-FR-27; D01, D02). La vista previa no cambia nada; reembolsar exige la casilla de
	// confirmación. El administrador indica los créditos a retirar; el importe en euros solo se pide en compras reales.
	// Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});

	/** Texto de un error de campo. El servidor devuelve códigos concretos; `validation_invalid` queda como respaldo genérico. */
	function fieldErrorText(code: string | undefined): string {
		if (!code) return '';
		switch (code) {
			case 'validation_required':
				return m.validation_required();
			case 'amount_invalid':
				return m.admin_refund_amount_invalid();
			case 'credits_invalid':
				return m.admin_refund_credits_invalid();
			case 'credits_zero':
				return m.admin_refund_credits_zero();
			default:
				return m.validation_invalid();
		}
	}
</script>

<svelte:head>
	<title>{m.admin_refund_title()}</title>
</svelte:head>

<h1>{m.admin_refund_title()}</h1>
<p>
	{data.purchase.packName} · {formatEuros(data.purchase.priceCents)} · {formatCredits(
		data.purchase.creditsMicro
	)}
</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_refund_error()}</Banner>
{/if}

{#if form?.preview}
	<section aria-labelledby="vista-previa-reembolso">
		<h2 id="vista-previa-reembolso">{m.admin_refund_preview()}</h2>
		{#if !form.preview.simulated}
			<p>{formatEuros(form.preview.refundEurCents)}</p>
		{/if}
		<p>
			{m.admin_refund_credits_withdrawn()}
			{formatCredits(form.preview.creditsToRemoveMicro)}
		</p>
	</section>
{/if}

<form method="POST">
	<input type="hidden" name="clave" value={data.refundKey} />
	{#if !data.purchase.simulated}
		<TextField
			id="importe"
			name="importe"
			label={m.admin_refund_amount_cents()}
			error={fieldErrorText(errors.importe)}
			required
		/>
	{/if}
	<TextField
		id="creditos"
		name="creditos"
		label={m.admin_adjust_amount()}
		error={fieldErrorText(errors.creditos)}
		required
	/>
	<TextField
		id="motivo"
		name="motivo"
		label={m.admin_refund_reason()}
		error={fieldErrorText(errors.motivo)}
		required
	/>
	<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_refund_confirm()}</Checkbox>
	<p>
		<Button type="submit" formaction="?/previsualizarReembolso" variant="secondary"
			>{m.admin_refund_preview_submit()}</Button
		>
		<Button type="submit" formaction="?/reembolsar" variant="primary"
			>{m.admin_refund_submit()}</Button
		>
	</p>
</form>
