<script lang="ts">
	// W22 · `/panel/movimientos`: lista de movimientos con filtro GET (sin JavaScript), paginación que conserva los filtros y
	// exportación con los mismos filtros (W23). Vacío legítimo y «sin coincidencias» por separado (UX-09).
	import { formatCredits } from '$lib/format/credits';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { queryOfFilters } from '$lib/schemas/common/filters';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function typeLabel(type: string): string {
		switch (type) {
			case 'welcome':
				return m.movement_type_welcome();
			case 'purchase':
				return m.movement_type_purchase();
			case 'usage':
				return m.movement_type_usage();
			case 'adjustment':
				return m.movement_type_adjustment();
			case 'expiry':
				return m.movement_type_expiry();
			case 'refund':
				return m.movement_type_refund();
			case 'chargeback':
				return m.movement_type_chargeback();
			default:
				return m.movement_type_debt_settlement();
		}
	}

	// Los créditos llegan convertidos de micro-créditos; se formatean con la regla de BE-FR-22.
	const creditsText = (credits: number): string => formatCredits(Math.round(credits * 1_000_000));
	const rows = $derived(
		data.rows.map((row) => [row.date, typeLabel(row.type), creditsText(row.credits), row.appName])
	);
	const columns = [
		{ key: 'date', label: m.movements_col_date(), align: 'start' as const },
		{ key: 'type', label: m.movements_col_type(), align: 'start' as const },
		{ key: 'credits', label: m.movements_col_credits(), align: 'end' as const },
		{ key: 'app', label: m.movements_col_app(), align: 'start' as const }
	];
	const hrefFor = (page: number): string =>
		data.filters === null
			? ''
			: `${resolve('/panel/movimientos')}${queryOfFilters(data.filters, page)}`;
</script>

<svelte:head>
	<title>{m.movements_title()}</title>
</svelte:head>

<h1>{m.movements_title()}</h1>

{#if Object.keys(data.errors).length > 0}
	<Banner level="critical">{m.movements_filter_error()}</Banner>
{/if}

<form method="GET" action={resolve('/panel/movimientos')}>
	<fieldset>
		<legend>{m.movements_filters_legend()}</legend>
		<TextField
			id="filtro-desde"
			name="desde"
			label={m.movements_from_label()}
			value={data.echo.desde ?? ''}
			hint={m.movements_hint()}
			error={data.errors.desde ?? ''}
		/>
		<TextField
			id="filtro-hasta"
			name="hasta"
			label={m.movements_to_label()}
			value={data.echo.hasta ?? ''}
			error={data.errors.hasta ?? ''}
		/>
		<div class="field">
			<label for="filtro-app">{m.movements_app_label()}</label>
			<select id="filtro-app" name="app">
				<option value="" selected={data.filters?.app === null || data.filters === null}>
					{m.movements_app_all()}
				</option>
				{#each data.appOptions as option (option.value)}
					<option value={option.value} selected={data.filters?.app === option.value}>
						{option.label}
					</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="filtro-orden">{m.movements_order_label()}</label>
			<select id="filtro-orden" name="orden">
				<option value="desc" selected={data.filters?.orden !== 'asc'}
					>{m.movements_order_desc()}</option
				>
				<option value="asc" selected={data.filters?.orden === 'asc'}
					>{m.movements_order_asc()}</option
				>
			</select>
		</div>
		<Button type="submit" variant="primary">{m.movements_apply()}</Button>
	</fieldset>
</form>

{#if data.exportHref !== null}
	<p><Button href={data.exportHref} variant="secondary">{m.movements_export()}</Button></p>
{/if}

{#if rows.length > 0}
	<DataTable caption={m.movements_caption()} {columns} {rows} />
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
		filter={[data.echo.desde ?? '', data.echo.hasta ?? ''].join(' ').trim()}
	/>
{/if}
