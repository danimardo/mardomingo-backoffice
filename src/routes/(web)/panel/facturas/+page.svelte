<script lang="ts">
	// W30 · `/panel/facturas`: lista de facturas con fecha, tipo, número e importe. Vacío legítimo si la cuenta no tiene facturas.
	import * as m from '$lib/paraglide/messages.js';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
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

<form method="GET" action={resolve('/panel/facturas')}>
	<fieldset>
		<legend>{m.invoices_filters_legend()}</legend>
		<div class="campo">
			<label for="filtro-tipo">{m.invoices_kind_filter()}</label>
			<select id="filtro-tipo" name="tipo">
				<option value="" selected={data.filters.tipo === ''}>{m.invoices_kind_all()}</option>
				<option value="full" selected={data.filters.tipo === 'full'}
					>{m.invoices_kind_full()}</option
				>
				<option value="simplified" selected={data.filters.tipo === 'simplified'}
					>{m.invoices_kind_simplified()}</option
				>
				<option value="corrective" selected={data.filters.tipo === 'corrective'}
					>{m.invoices_kind_corrective()}</option
				>
			</select>
		</div>
		<div class="campo">
			<label for="filtro-orden">{m.invoices_order()}</label>
			<select id="filtro-orden" name="orden">
				<option value="desc" selected={data.filters.orden === 'desc'}
					>{m.invoices_order_desc()}</option
				>
				<option value="asc" selected={data.filters.orden === 'asc'}>{m.invoices_order_asc()}</option
				>
			</select>
		</div>
		<Button type="submit" variant="primary">{m.invoices_apply()}</Button>
	</fieldset>
</form>

{#if rows.length > 0}
	<DataTable caption={m.invoices_caption()} {columns} {rows} />
	<Pagination
		current={data.pagination.page}
		total={data.pagination.pages}
		hrefFor={(page) => data.pagination.pageHrefs[page - 1] ?? ''}
	/>
{:else if data.filters.tipo !== ''}
	<p>{m.invoices_no_match()}</p>
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
