<script lang="ts">
	// W30 · `/panel/facturas`: lista de facturas con fecha, tipo, número e importe. Vacío legítimo si la cuenta no tiene facturas.
	import * as m from '$lib/paraglide/messages.js';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { formatEuros } from '$lib/components/payments/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function kindLabel(kind: string): string {
		switch (kind) {
			case 'full':
				return m.invoices_kind_full();
			case 'corrective':
				return m.invoices_kind_corrective();
			default:
				return m.invoices_kind_simplified();
		}
	}

	const rows = $derived(
		data.invoices.map((invoice) => [
			invoice.date,
			kindLabel(invoice.kind),
			invoice.number,
			formatEuros(invoice.amountEurCents)
		])
	);
	const columns = [
		{ key: 'date', label: m.invoices_col_date(), align: 'start' as const },
		{ key: 'kind', label: m.invoices_col_kind(), align: 'start' as const },
		{ key: 'number', label: m.invoices_col_number(), align: 'start' as const },
		{ key: 'amount', label: m.invoices_col_amount(), align: 'end' as const }
	];
</script>

<svelte:head>
	<title>{m.invoices_title()}</title>
</svelte:head>

<h1>{m.invoices_title()}</h1>

{#if data.requested}
	<Banner level="info">{m.invoices_full_requested()}</Banner>
{/if}
{#if form?.formError === 'BILLING_PROFILE_INCOMPLETE'}
	<Banner level="critical">
		{m.invoices_billing_incomplete()}
		<a href={resolve('/panel/perfil')}>{m.invoices_billing_link()}</a>
	</Banner>
{/if}

{#if rows.length > 0}
	<DataTable caption={m.invoices_caption()} {columns} {rows} />
{:else}
	<EmptyState variant="empty" />
{/if}

{#if data.purchases.length > 0}
	<section aria-labelledby="factura-completa">
		<h2 id="factura-completa">{m.invoices_full_heading()}</h2>
		<p>{m.invoices_full_intro()}</p>
		<form method="POST" action="?/solicitarFacturaCompleta">
			<div class="campo">
				<label for="factura-compra">{m.invoices_full_purchase()}</label>
				<select id="factura-compra" name="paymentId">
					{#each data.purchases as purchase (purchase.id)}
						<option value={purchase.id}>{purchase.label}</option>
					{/each}
				</select>
			</div>
			<p><Button type="submit" variant="secondary">{m.invoices_full_submit()}</Button></p>
		</form>
	</section>
{/if}
