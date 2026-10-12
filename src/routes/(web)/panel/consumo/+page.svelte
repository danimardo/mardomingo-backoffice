<script lang="ts">
	// W24 · `/panel/consumo`: operaciones de IA de la cuenta con su estado y los créditos cobrados. Filtro GET sin JavaScript.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { queryOfFilters } from '$lib/schemas/common/filters';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function statusLabel(status: string): string {
		switch (status) {
			case 'ok':
				return m.consumption_status_ok();
			case 'provider_error':
				return m.consumption_status_provider_error();
			case 'cancelled':
				return m.consumption_status_cancelled();
			case 'undelivered':
				return m.consumption_status_undelivered();
			case 'interrupted':
				return m.consumption_status_interrupted();
			case 'rejected':
				return m.consumption_status_rejected();
			case 'in_progress':
				return m.consumption_status_in_progress();
			default:
				return m.consumption_status_unknown();
		}
	}

	const creditsFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
	const rows = $derived(
		data.rows.map((row) => [
			row.date,
			row.appName,
			row.operation,
			statusLabel(row.status),
			creditsFormat.format(row.credits)
		])
	);
	const columns = [
		{ key: 'date', label: m.consumption_col_date(), align: 'start' as const },
		{ key: 'app', label: m.consumption_col_app(), align: 'start' as const },
		{ key: 'operation', label: m.consumption_col_operation(), align: 'start' as const },
		{ key: 'status', label: m.consumption_col_status(), align: 'start' as const },
		{ key: 'credits', label: m.consumption_col_credits(), align: 'end' as const }
	];
	const hrefFor = (page: number): string =>
		data.filters === null
			? ''
			: `${resolve('/panel/consumo')}${queryOfFilters(data.filters, page)}`;
</script>

<svelte:head>
	<title>{m.consumption_title()}</title>
</svelte:head>

<h1>{m.consumption_title()}</h1>

{#if Object.keys(data.errors).length > 0}
	<Banner level="critical">{m.movements_filter_error()}</Banner>
{/if}

<form method="GET" action={resolve('/panel/consumo')}>
	<fieldset>
		<legend>{m.movements_filters_legend()}</legend>
		<TextField
			id="consumo-desde"
			name="desde"
			label={m.movements_from_label()}
			value={data.echo.desde}
			error={data.errors.desde ?? ''}
		/>
		<TextField
			id="consumo-hasta"
			name="hasta"
			label={m.movements_to_label()}
			value={data.echo.hasta}
			error={data.errors.hasta ?? ''}
		/>
		<Button type="submit" variant="primary">{m.movements_apply()}</Button>
	</fieldset>
</form>

{#if rows.length > 0}
	<DataTable caption={m.consumption_caption()} {columns} {rows} />
	{#if data.pagination !== null}
		<Pagination
			current={data.pagination.page}
			total={data.pagination.hasNext ? data.pagination.page + 1 : data.pagination.page}
			{hrefFor}
		/>
	{/if}
{:else if Object.keys(data.errors).length === 0}
	<EmptyState
		variant={data.applied ? 'no-match' : 'empty'}
		filter={[data.echo.desde, data.echo.hasta].join(' ').trim()}
	/>
{/if}
