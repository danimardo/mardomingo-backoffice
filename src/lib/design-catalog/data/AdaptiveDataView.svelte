<script lang="ts" generics="T">
	/**
	 * AdaptiveDataView (§17, §70) — la pieza insignia de la filosofía
	 * "adaptativo, no solo responsive":
	 *
	 *   AdaptiveDataView
	 *   ├── Mobile  → tarjetas (`DataCard`)
	 *   ├── Tablet  → `StructuredList`
	 *   └── Desktop → `DataTable`
	 *
	 * Las tres representaciones reciben literalmente el mismo `data`/
	 * `columns`/`rowKey` y comparten `selected`/`sort` (bindable) y
	 * `actions`/`loading`/`empty` — cambiar de nivel no pierde selección
	 * ni orden porque es el MISMO estado, no una copia por vista.
	 *
	 * El nivel activo se decide por el ANCHO DEL CONTENEDOR
	 * (`bind:clientWidth`, con `ResizeObserver` por debajo — no
	 * `matchMedia`/viewport), mismo criterio que `Grid.minColumnWidth` en
	 * Fase 1: un `AdaptiveDataView` metido en un panel estrecho de una
	 * pantalla ancha debe verse "Mobile" igual que en un móvil de verdad.
	 * Solo se renderiza UNA representación a la vez (no las tres ocultas
	 * con `display:none`) — evita triplicar el trabajo de render/
	 * reactividad por fila, a costa de un `$effect` de medición en vez de
	 * un `@container` puro en CSS.
	 *
	 * Alcance deliberado de "comparte... filtros/paginación/búsqueda"
	 * (§17): `AdaptiveDataView` comparte el ESTADO (selección/orden) que
	 * ya existe en Fase 4, pero no trae su propia UI de filtros,
	 * paginación ni búsqueda — `FilterBar` es Fase 6 y no hay un
	 * componente de paginación en ningún catálogo curado todavía. El
	 * consumidor filtra/pagina/busca ANTES de pasar `data` (el array ya
	 * es "la página/resultado actual que toca pintar"), igual que
	 * `sortedData` de `DataTable` asume que `data` ya es el conjunto a
	 * mostrar, no todo el dataset sin acotar.
	 *
	 * Nota de contraste (ver también DataCardStatus y docs/TOKENS.md): las
	 * acciones del nivel Mobile usan el mismo patrón "punto de color +
	 * texto neutro" que `DataCardStatus`, no texto coloreado, porque viven
	 * dentro de un `DataCard` (`--surface-raised`). `Button`/`IconButton`
	 * con `variant="danger"` tenían el mismo problema latente
	 * (`--status-danger` como texto) si se colocaban sobre
	 * `--surface-raised` — no se tocó en Fase 4 para no alterar el
	 * comportamiento visual de una pieza de Fase 1 sin una revisión
	 * propia; corregido después con un token dedicado, `--text-danger`
	 * (ver docs/TOKENS.md/docs/ROADMAP.md).
	 */
	import type { Snippet } from "svelte";
	import DataCard from "./DataCard.svelte";
	import CardHeader from "./CardHeader.svelte";
	import CardBody from "./CardBody.svelte";
	import CardFooter from "./CardFooter.svelte";
	import CardActions from "./CardActions.svelte";
	import DataCardField from "./DataCardField.svelte";
	import StructuredList from "./StructuredList.svelte";
	import DataTable from "./DataTable.svelte";
	import { Stack } from "../primitives/index.js";
	import type { DataColumn, DataAction, RowKey, SortState } from "./types.js";
	// `BREAKPOINT_CONTAINER_PX`: espejo en JS de --breakpoint-container-*
	// (tokens.css) — ronda de ampliación UX post-v0.14.0, ver
	// docs/ROADMAP.md. Los valores por defecto de `tabletBreakpoint`/
	// `desktopBreakpoint` ya no son números sueltos: provienen de la
	// escala compartida, aunque el consumidor siga pudiendo pasar los
	// suyos propios.
	import { BREAKPOINT_CONTAINER_PX } from "../tokens/index.js";

	interface Props {
		data: T[];
		columns: DataColumn<T>[];
		rowKey?: RowKey<T> | undefined;
		selected?: Set<string> | undefined;
		sort?: SortState | null | undefined;
		/** Solo tiene efecto en el nivel Desktop (`DataTable`) — ver `DataColumn.resizable`. Se conserva si vuelves a Desktop tras pasar por Mobile/Tablet, igual que `sort`. */
		columnWidths?: Record<string, string> | undefined;
		onRowClick?: ((row: T) => void) | undefined;
		/**
		 * v1.7.0 — color de identidad de la fila (p. ej. `employeeColorVar(n)`): fondo muy suave (8 %) que se marca
		 * más (16 %) al pasar el ratón o con el foco dentro. Nunca es el único canal: la fila ya nombra a quien
		 * identifica. `undefined` = sin tinte.
		 */
		rowTint?: ((row: T) => string | undefined) | undefined;
		actions?: DataAction<T>[] | undefined;
		loading?: boolean | undefined;
		empty?: Snippet | undefined;
		/** Tarjeta a medida para el nivel Mobile — si se omite, se genera una a partir de `columns` (primera columna = título, resto = `DataCardField`). */
		card?: Snippet<[T]> | undefined;
		/** Ancho de contenedor (px) a partir del cual se pasa de tarjetas a `StructuredList`. */
		tabletBreakpoint?: number | undefined;
		/** Ancho de contenedor (px) a partir del cual se pasa de `StructuredList` a `DataTable`. */
		desktopBreakpoint?: number | undefined;
		class?: string | undefined;
	}

	let {
		data,
		columns,
		rowKey,
		selected = $bindable(new Set<string>()),
		sort = $bindable(null),
		columnWidths = $bindable({}),
		onRowClick,
		rowTint,
		actions,
		loading = false,
		empty,
		card,
		tabletBreakpoint = BREAKPOINT_CONTAINER_PX.md,
		desktopBreakpoint = BREAKPOINT_CONTAINER_PX.xl,
		class: className = ""
	}: Props = $props();

	let width = $state(0);

	// Mobile-first: antes de la primera medición (width = 0) se pinta la
	// tarjeta, el nivel más seguro en cualquier ancho.
	let tier = $derived(width >= desktopBreakpoint ? "desktop" : width >= tabletBreakpoint ? "tablet" : "mobile");

	let primaryColumn = $derived(columns[0]);
	let secondaryColumns = $derived(columns.slice(1));

	function cellText(column: DataColumn<T>, row: T): string {
		const value = (row as Record<string, unknown>)[column.key];
		return value == null ? "" : String(value);
	}
</script>

<div bind:clientWidth={width} class="gg-adaptive-data-view {className}">
	{#if tier === "desktop"}
		<DataTable {data} {columns} {rowKey} bind:selected bind:sort bind:columnWidths {onRowClick} {rowTint} {actions} {loading} {empty} />
	{:else if tier === "tablet"}
		<StructuredList {data} {columns} {rowKey} bind:selected {onRowClick} {rowTint} {actions} {loading} {empty} />
	{:else if loading}
		<div class="gg-adaptive-data-view__status" role="status" aria-live="polite">
			<span class="gg-adaptive-data-view__spinner" aria-hidden="true"></span>
			Cargando…
		</div>
	{:else if data.length === 0}
		{#if empty}
			{@render empty()}
		{:else}
			<div class="gg-adaptive-data-view__status">No hay elementos que mostrar.</div>
		{/if}
	{:else}
		<Stack gap={3}>
			{#each data as row (rowKey ? rowKey(row) : JSON.stringify(row))}
				{@const key = rowKey ? rowKey(row) : ""}
				{#if card}
					{@render card(row)}
				{:else}
					{@const tint = rowTint?.(row)}
					<DataCard
						class={tint ? "gg-adaptive-data-view__card--tinted" : ""}
						style={tint ? `--gg-row-tint: ${tint}` : ""}
						selected={rowKey ? selected.has(key) : false}
						onSelectChange={rowKey
							? (isSelected) => {
									const next = new Set(selected);
									if (isSelected) next.add(key);
									else next.delete(key);
									selected = next;
								}
							: undefined}
					>
						<CardHeader>
							{#if primaryColumn?.cell}
								{@render primaryColumn.cell(row)}
							{:else if primaryColumn}
								{cellText(primaryColumn, row)}
							{/if}
						</CardHeader>
						{#if secondaryColumns.length}
							<CardBody>
								{#each secondaryColumns as column (column.key)}
									<DataCardField label={column.label}>
										{#if column.cell}
											{@render column.cell(row)}
										{:else}
											{cellText(column, row)}
										{/if}
									</DataCardField>
								{/each}
							</CardBody>
						{/if}
						{#if actions?.length}
							<CardFooter>
								<CardActions>
									{#each actions as action (action.label)}
										<button
											type="button"
											class="gg-adaptive-data-view__action"
											disabled={action.disabled?.(row)}
											onclick={() => action.onclick(row)}
										>
											<span
												class="gg-adaptive-data-view__action-dot"
												class:gg-adaptive-data-view__action-dot--danger={action.danger}
												aria-hidden="true"
											></span>
											{action.label}
										</button>
									{/each}
								</CardActions>
							</CardFooter>
						{/if}
					</DataCard>
				{/if}
			{/each}
		</Stack>
	{/if}
</div>

<style>
	/* v1.7.0 — tinte de identidad en la tarjeta del nivel Mobile (`rowTint`),
	   mismo criterio que DataTable/StructuredList. */
	:global(.gg-data-card.gg-adaptive-data-view__card--tinted) {
		background: color-mix(in srgb, var(--gg-row-tint) 8%, var(--surface-raised));
	}

	:global(.gg-data-card.gg-adaptive-data-view__card--tinted:focus-within) {
		background: color-mix(in srgb, var(--gg-row-tint) 16%, var(--surface-raised));
	}

	.gg-adaptive-data-view {
		width: 100%;
	}

	.gg-adaptive-data-view__status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-8);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-adaptive-data-view__spinner {
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--radius-full);
		border: 2px solid var(--border-strong);
		border-top-color: var(--text-muted);
		animation: gg-adaptive-data-view-spin var(--duration-slow) linear infinite;
	}

	@keyframes gg-adaptive-data-view-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.gg-adaptive-data-view__action {
		/* A diferencia de StructuredList/DataTable (fondo transparente o
		   heredado, seguro), aquí el botón vive DENTRO de un DataCard con
		   elevation="raised" (fondo --surface-raised). --interactive-primary/
		   --status-danger como TEXTO fallan AA contra ese fondo (3.87:1 /
		   4.10:1 en oscuro — ver docs/TOKENS.md), el mismo problema ya
		   resuelto en DataCardStatus: el color se mueve a un punto NO
		   textual (WCAG 1.4.11, ≥3:1 — los cuatro colores de estado lo
		   cumplen con holgura contra --surface-raised) y el texto se queda
		   en --text-primary, siempre seguro en cualquier fondo del sistema. */
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
	}

	.gg-adaptive-data-view__action:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.gg-adaptive-data-view__action:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-adaptive-data-view__action:disabled .gg-adaptive-data-view__action-dot {
		background: var(--text-disabled);
	}

	.gg-adaptive-data-view__action-dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		background: var(--interactive-primary);
		flex-shrink: 0;
	}

	.gg-adaptive-data-view__action-dot--danger {
		background: var(--status-danger);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-adaptive-data-view__spinner {
			animation: none;
		}
	}
</style>
