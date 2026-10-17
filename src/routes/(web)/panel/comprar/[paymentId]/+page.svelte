<script lang="ts">
	// W21 · resultado de la compra: paquete, precio con IVA incluido, créditos, saldo nuevo y, si se repitió, el aviso (UX-05).
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const vatCents = $derived(data.purchase.vatCents);
</script>

<svelte:head>
	<title>{m.payments_result_title()}</title>
</svelte:head>

<h1>{m.payments_result_title()}</h1>

{#if data.repeated}
	<Notice tone="info">
		<p>{m.payments_repeated()}</p>
	</Notice>
{/if}

<dl class="result">
	<dt>{m.payments_result_pack()}</dt>
	<dd>{data.purchase.packName}</dd>
	<dt>{m.payments_result_price()}</dt>
	<dd>
		{formatEuros(data.purchase.priceCents)} ({m.payments_vat_included_amount({
			vat: formatEuros(vatCents)
		})})
	</dd>
	<dt>{m.payments_result_credits()}</dt>
	<dd>{formatCredits(data.purchase.creditsMicro)}</dd>
	<dt>{m.payments_result_balance()}</dt>
	<dd>{formatCredits(data.balanceMicro)}</dd>
	{#if data.purchase.simulated}
		<dt>{m.payments_result_mode()}</dt>
		<dd>{m.payments_result_simulated()}</dd>
	{/if}
</dl>

<p><a href={resolve('/panel')}>{m.payments_back_to_account()}</a></p>

<style>
	.result {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1rem;
		font-variant-numeric: tabular-nums;
	}
	.result dd {
		margin: 0;
	}
</style>
