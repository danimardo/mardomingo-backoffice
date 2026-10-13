<script lang="ts">
	// W30 · `/panel/facturas`: lista de facturas con fecha, tipo, número e importe. Vacío legítimo si la cuenta no tiene facturas.
	import * as m from '$lib/paraglide/messages.js';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formatEuros } from '$lib/components/payments/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

{#if rows.length > 0}
	<DataTable caption={m.invoices_caption()} {columns} {rows} />
{:else}
	<EmptyState variant="empty" />
{/if}
