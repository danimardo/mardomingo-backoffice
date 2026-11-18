<script lang="ts" generics="T">
	/**
	 * ListPage (§50) — plantilla de pantalla completa: `PageHeader` +
	 * `FilterBar` (opcional) + `AdaptiveDataView`, cableados entre sí. No
	 * es una pieza de UI nueva — es la prueba de que el resto del paquete
	 * encaja: recibe literalmente las mismas props que ya conoces de
	 * `PageHeader` (Fase 6) y `AdaptiveDataView` (Fase 4), sin remapearlas.
	 *
	 * `filters`/`activeFilters`/`onClearFilters` son opcionales — si no
	 * se pasa ninguno, `FilterBar` ni se monta (una lista sin filtros no
	 * necesita la barra vacía).
	 */
	import type { Snippet } from "svelte";
	import PageHeader from "./PageHeader.svelte";
	import FilterBar from "./FilterBar.svelte";
	import { AdaptiveDataView } from "../data/index.js";
	import type { BreadcrumbItem } from "../navigation/index.js";
	import type { DataColumn, DataAction, RowKey, SortState } from "../data/index.js";
	import type { ResponsiveActionItem, FilterBarChip } from "./types.js";

	interface Props {
		title: string;
		subtitle?: string | undefined;
		breadcrumb?: BreadcrumbItem[] | undefined;
		headerActions?: ResponsiveActionItem[] | undefined;
		filters?: Snippet | undefined;
		activeFilters?: FilterBarChip[] | undefined;
		onClearFilters?: (() => void) | undefined;
		data: T[];
		columns: DataColumn<T>[];
		rowKey?: RowKey<T> | undefined;
		selected?: Set<string> | undefined;
		sort?: SortState | null | undefined;
		onRowClick?: ((row: T) => void) | undefined;
		dataActions?: DataAction<T>[] | undefined;
		loading?: boolean | undefined;
		empty?: Snippet | undefined;
		card?: Snippet<[T]> | undefined;
		tabletBreakpoint?: number | undefined;
		desktopBreakpoint?: number | undefined;
		class?: string | undefined;
	}

	let {
		title,
		subtitle,
		breadcrumb,
		headerActions,
		filters,
		activeFilters,
		onClearFilters,
		data,
		columns,
		rowKey,
		selected = $bindable(new Set<string>()),
		sort = $bindable(null),
		onRowClick,
		dataActions,
		loading = false,
		empty,
		card,
		tabletBreakpoint = 640,
		desktopBreakpoint = 960,
		class: className = ""
	}: Props = $props();

	let hasFilterBar = $derived(!!filters || !!(activeFilters && activeFilters.length));
</script>

<div class="gg-list-page {className}">
	<PageHeader {title} {subtitle} {breadcrumb} actions={headerActions} />
	{#if hasFilterBar}
		<FilterBar {activeFilters} onClearAll={onClearFilters}>
			{@render filters?.()}
		</FilterBar>
	{/if}
	<AdaptiveDataView
		{data}
		{columns}
		{rowKey}
		bind:selected
		bind:sort
		{onRowClick}
		actions={dataActions}
		{loading}
		{empty}
		{card}
		{tabletBreakpoint}
		{desktopBreakpoint}
	/>
</div>

<style>
	.gg-list-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
</style>
