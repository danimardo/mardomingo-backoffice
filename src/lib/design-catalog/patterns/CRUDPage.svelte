<script lang="ts" generics="T">
	/**
	 * CRUDPage (§50) — envoltorio FINO de máquina de estados
	 * list/detail/create/edit alrededor de `ListPage`/`DetailPage`: decide
	 * qué "pantalla" se ve y le pasa el registro seleccionado, nada más.
	 * Del catálogo de 6 piezas de §50 (`ListPage`/`DetailPage`/
	 * `CreatePage`/`EditPage`/`SettingsPage`/`CRUDPage`) `CreatePage`/
	 * `EditPage` no se construyen aparte — son el MISMO `form` (create con
	 * `row: null`, edit con `row` real), mismo criterio que ya evitó
	 * duplicar `Dialog` en `ConfirmDialog`/`AlertDialog` en Fase 5;
	 * `SettingsPage` no tiene sentido genérico sin saber qué es "un
	 * ajuste" en tu producto, fuera de alcance.
	 *
	 * Decisión de alcance deliberada (documentada también en
	 * `docs/ROADMAP.md`): `CRUDPage` NO sabe nada de tus campos, tu
	 * validación ni tus peticiones de red — no genera un formulario, no
	 * llama a ningún API. Solo:
	 *   1. Pinta `ListPage` en modo "list", con clic de fila -> "detail".
	 *   2. Pinta `DetailPage` con tu `detail` snippet en modo "detail".
	 *   3. Pinta `DetailPage` con tu `form` snippet en modo "create"/"edit"
	 *      (el MISMO snippet en ambos, recibe `{ mode, row }`).
	 * Guardar/cancelar/eliminar de verdad los decide y ejecuta tu propio
	 * `form`/`detail` — `CRUDPage` solo te da `onDone()` para volver a la
	 * lista cuando termines. Selección/orden de la tabla (`selected`/
	 * `sort` de `AdaptiveDataView`) los gestiona `CRUDPage` internamente
	 * como estado propio — no forman parte de "qué pantalla se ve", así
	 * que no se exponen como prop pública (a diferencia de `ListPage`,
	 * que sí los deja bindable para un consumidor que la use suelta).
	 */
	import type { Snippet } from "svelte";
	import ListPage from "./ListPage.svelte";
	import DetailPage from "./DetailPage.svelte";
	import type { BreadcrumbItem } from "../navigation/index.js";
	import type { DataColumn, DataAction, RowKey, SortState } from "../data/index.js";
	import type { ResponsiveActionItem, FilterBarChip, CRUDMode } from "./types.js";

	interface Props {
		mode?: CRUDMode | undefined;
		selectedRow?: T | null | undefined;

		/** Título de la pantalla de lista. */
		listTitle: string;
		listSubtitle?: string | undefined;
		breadcrumb?: BreadcrumbItem[] | undefined;
		data: T[];
		columns: DataColumn<T>[];
		rowKey?: RowKey<T> | undefined;
		filters?: Snippet | undefined;
		activeFilters?: FilterBarChip[] | undefined;
		onClearFilters?: (() => void) | undefined;
		/** Acciones de cabecera ADEMÁS de "Nuevo" (que solo aparece si se pasa `form`). */
		listActions?: ResponsiveActionItem[] | undefined;
		dataActions?: DataAction<T>[] | undefined;
		loading?: boolean | undefined;
		empty?: Snippet | undefined;
		card?: Snippet<[T]> | undefined;
		tabletBreakpoint?: number | undefined;
		desktopBreakpoint?: number | undefined;

		/** Título de la pantalla de detalle a partir del registro. */
		detailTitle?: ((row: T) => string) | undefined;
		/** Acciones de cabecera del detalle ADEMÁS de "Volver"/"Editar" (que se añaden solas). */
		detailActions?: ((row: T) => ResponsiveActionItem[]) | undefined;
		detail?: Snippet<[T]> | undefined;

		/** Título de la pantalla de creación/edición. Por defecto usa `createLabel`/`editLabel`. */
		formTitle?: ((mode: "create" | "edit", row: T | null) => string) | undefined;
		/** Mismo snippet para crear (`row: null`) y editar (`row` real). */
		form?: Snippet<[{ mode: "create" | "edit"; row: T | null }]> | undefined;

		createLabel?: string | undefined;
		editLabel?: string | undefined;
		backLabel?: string | undefined;
		cancelLabel?: string | undefined;

		class?: string | undefined;
	}

	let {
		mode = $bindable("list"),
		selectedRow = $bindable(null),
		listTitle,
		listSubtitle,
		breadcrumb,
		data,
		columns,
		rowKey,
		filters,
		activeFilters,
		onClearFilters,
		listActions,
		dataActions,
		loading = false,
		empty,
		card,
		tabletBreakpoint = 640,
		desktopBreakpoint = 960,
		detailTitle,
		detailActions,
		detail,
		formTitle,
		form,
		createLabel = "Nuevo",
		editLabel = "Editar",
		backLabel = "Volver a la lista",
		cancelLabel = "Cancelar",
		class: className = ""
	}: Props = $props();

	let selected = $state<Set<string>>(new Set());
	let sort = $state<SortState | null>(null);

	function goList() {
		mode = "list";
		selectedRow = null;
	}
	function goCreate() {
		selectedRow = null;
		mode = "create";
	}
	function goDetail(row: T) {
		selectedRow = row;
		mode = "detail";
	}
	function goEdit() {
		mode = "edit";
	}
	function cancelForm() {
		mode = selectedRow ? "detail" : "list";
	}

	let listHeaderActions = $derived<ResponsiveActionItem[]>([
		...(form ? [{ label: createLabel, onclick: goCreate }] : []),
		...(listActions ?? [])
	]);

	let detailHeaderActions = $derived<ResponsiveActionItem[]>(
		selectedRow
			? [
					{ label: backLabel, onclick: goList },
					...(form ? [{ label: editLabel, onclick: goEdit }] : []),
					...(detailActions?.(selectedRow) ?? [])
				]
			: []
	);

	let formHeaderTitle = $derived(
		mode === "edit"
			? (formTitle?.("edit", selectedRow) ?? editLabel)
			: (formTitle?.("create", null) ?? createLabel)
	);
</script>

<div class="gg-crud-page {className}">
	{#if mode === "list"}
		<ListPage
			title={listTitle}
			subtitle={listSubtitle}
			{breadcrumb}
			headerActions={listHeaderActions}
			{filters}
			{activeFilters}
			{onClearFilters}
			{data}
			{columns}
			{rowKey}
			bind:selected
			bind:sort
			onRowClick={goDetail}
			{dataActions}
			{loading}
			{empty}
			{card}
			{tabletBreakpoint}
			{desktopBreakpoint}
		/>
	{:else if mode === "detail" && selectedRow}
		<DetailPage title={detailTitle ? detailTitle(selectedRow) : listTitle} {breadcrumb} actions={detailHeaderActions}>
			{@render detail?.(selectedRow)}
		</DetailPage>
	{:else if mode === "create" || mode === "edit"}
		<DetailPage
			title={formHeaderTitle}
			{breadcrumb}
			actions={[{ label: cancelLabel, onclick: cancelForm }]}
		>
			{@render form?.({ mode, row: mode === "edit" ? selectedRow : null })}
		</DetailPage>
	{/if}
</div>

<style>
	.gg-crud-page {
		display: flex;
		flex-direction: column;
	}
</style>
