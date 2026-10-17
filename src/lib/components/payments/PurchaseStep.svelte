<script lang="ts">
	// Paso de confirmación de la compra (W20): paquete, precio con IVA incluido, renuncia al desistimiento sin premarcar,
	// factura completa opcional y envío único (`aria-busy` mientras se procesa, sin doble envío).
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import BillingFields from './BillingFields.svelte';
	import { formatCredits, formatEuros } from './format';

	interface Pack {
		readonly id: string;
		readonly name: string;
		readonly priceCents: number;
		readonly creditsMicro: number;
	}

	let {
		pack,
		intentId,
		waiverVersion,
		billing,
		errors = {},
		formError = ''
	}: {
		pack: Pack;
		intentId: string;
		waiverVersion: string | null;
		billing: { values?: Record<string, string | undefined> };
		errors?: Readonly<Record<string, string>>;
		formError?: string;
	} = $props();

	let wantsFullInvoice = $state(false);
	const billingErrored = $derived(Object.keys(errors).some((key) => key !== 'waiverAccepted'));
	let submitting = $state(false);
</script>

<form
	method="POST"
	action="?/comprar&paquete={pack.id}"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	<input type="hidden" name="packId" value={pack.id} />
	<input type="hidden" name="intentId" value={intentId} />
	<input type="hidden" name="waiverVersion" value={waiverVersion ?? ''} />

	<h2>{pack.name}</h2>
	<p class="figures">
		<span>{m.payments_confirm_price({ price: formatEuros(pack.priceCents) })}</span>
		<span>{m.payments_pack_credits({ credits: formatCredits(pack.creditsMicro) })}</span>
	</p>
	<p class="vat">{m.payments_vat_included()}</p>

	{#if formError}
		<Notice tone="danger">
			<p>{m.payments_error_form({ code: formError })}</p>
		</Notice>
	{/if}

	<Checkbox id="waiver-accepted" name="waiverAccepted" error={errors.waiverAccepted ?? ''}>
		{m.payments_waiver_label()}
	</Checkbox>

	<Checkbox id="want-full-invoice" name="wantsFullInvoice" bind:checked={wantsFullInvoice}>
		{m.payments_full_invoice_label()}
	</Checkbox>

	<!-- Sin JavaScript el bloque queda plegado, pero sus campos se envían igual: se puede abrir a mano. -->
	<details open={wantsFullInvoice || billingErrored}>
		<summary>{m.payments_billing_summary()}</summary>
		<BillingFields values={billing.values ?? {}} {errors} />
	</details>

	<p class="actions">
		<Button type="submit" variant="primary" busy={submitting} disabled={submitting}>
			{m.payments_submit({ price: formatEuros(pack.priceCents) })}
		</Button>
		<Button variant="ghost" href={resolve('/panel/comprar')}>{m.payments_back_to_packs()}</Button>
	</p>
</form>

<style>
	.figures {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
</style>
