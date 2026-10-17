<script lang="ts">
	// W46 · `/admin/auditoria`: lista de la auditoría con filtros GET y paginación (T303; BE-FR-55). Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const rows = $derived(
		data.rows.map((row) => [
			new Date(row.createdAt).toLocaleString('es-ES'),
			row.action,
			row.entity,
			row.reason ?? '',
			row.id
		])
	);
	const columns = [
		{ key: 'date', label: m.admin_audit_col_date(), align: 'start' as const },
		{ key: 'action', label: m.admin_audit_col_action(), align: 'start' as const },
		{ key: 'entity', label: m.admin_audit_col_entity(), align: 'start' as const },
		{ key: 'reason', label: m.admin_audit_col_reason(), align: 'start' as const },
		{ key: 'detail', label: m.admin_audit_col_detail(), align: 'start' as const }
	];
</script>

<svelte:head>
	<title>{m.admin_audit_title()}</title>
</svelte:head>

<h1>{m.admin_audit_title()}</h1>
<p>{m.admin_audit_intro()}</p>

<form id="paginacion" method="GET" action={resolve('/admin/auditoria')}>
	<div class="campo">
		<label for="filtro-entidad">{m.admin_audit_filter_entity()}</label>
		<input id="filtro-entidad" name="entidad" type="text" value={data.filters.entidad} />
	</div>
	<div class="campo">
		<label for="filtro-accion">{m.admin_audit_filter_action()}</label>
		<input id="filtro-accion" name="accion" type="text" value={data.filters.accion} />
	</div>
	<div class="campo">
		<label for="filtro-desde">{m.admin_audit_filter_from()}</label>
		<input id="filtro-desde" name="desde" type="date" value={data.filters.desde} />
	</div>
	<div class="campo">
		<label for="filtro-hasta">{m.admin_audit_filter_to()}</label>
		<input id="filtro-hasta" name="hasta" type="date" value={data.filters.hasta} />
	</div>
	<p><Button type="submit" variant="primary">{m.admin_audit_filter_submit()}</Button></p>
</form>

{#if data.rows.length === 0}
	<p>{m.admin_audit_empty()}</p>
{:else}
	<DataTable caption={m.admin_audit_title()} {columns} {rows} />
	<nav aria-label={m.admin_audit_title()}>
		{#if data.pagination.hasPrevious}
			<button
				type="submit"
				form="paginacion"
				name="pagina"
				value={String(data.pagination.page - 1)}
			>
				{m.admin_audit_previous()}
			</button>
		{/if}
		<span>{m.admin_audit_page({ page: String(data.pagination.page) })}</span>
		{#if data.pagination.hasNext}
			<button
				type="submit"
				form="paginacion"
				name="pagina"
				value={String(data.pagination.page + 1)}
			>
				{m.admin_audit_next()}
			</button>
		{/if}
	</nav>
{/if}
