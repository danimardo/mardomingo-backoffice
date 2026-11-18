<script lang="ts" generics="T">
	/**
	 * StructuredList — el nivel "Tablet" de `AdaptiveDataView` (§17, §70):
	 * más denso que `DataCard` (una fila por registro, no una tarjeta
	 * completa), más legible que `DataTable` en un ancho intermedio
	 * (columnas reflotadas como pares etiqueta/valor en vez de una
	 * rejilla rígida). No tiene sección propia en el catálogo — solo
	 * aparece nombrado dentro de los diagramas de `AdaptiveDataView`/§70
	 * — así que su forma es una decisión de este paquete, documentada
	 * aquí y en docs/ROADMAP.md.
	 *
	 * Comparte exactamente `columns`/`data` con `DataTable` (mismo tipo
	 * `DataColumn<T>` de `data/types.ts`) para que `AdaptiveDataView`
	 * pueda pasarle las mismas props que a `DataTable` sin que el
	 * consumidor escriba dos plantillas de fila distintas. La primera
	 * columna se pinta como título de la fila; el resto, como pares
	 * etiqueta/valor compactos.
	 */
	import type { Snippet } from "svelte";
	import List from "./List.svelte";
	import ListItem from "./ListItem.svelte";
	import Checkbox from "../forms/Checkbox.svelte";
	import type { DataColumn, DataAction, RowKey } from "./types.js";

	interface Props {
		data: T[];
		columns: DataColumn<T>[];
		/** Presente ⇒ se pinta checkbox de selección por fila (mismo criterio que `DataTable`). */
		rowKey?: RowKey<T> | undefined;
		selected?: Set<string> | undefined;
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
		class?: string | undefined;
	}

	let {
		data,
		columns,
		rowKey,
		selected = $bindable(new Set<string>()),
		onRowClick,
		rowTint,
		actions,
		loading = false,
		empty,
		class: className = ""
	}: Props = $props();

	let primaryColumn = $derived(columns[0]);
	let secondaryColumns = $derived(columns.slice(1));

	function cellText(column: DataColumn<T>, row: T): string {
		const value = (row as Record<string, unknown>)[column.key];
		return value == null ? "" : String(value);
	}

	function toggleSelection(key: string) {
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}
</script>

{#if loading}
	<div class="gg-structured-list__loading" role="status" aria-live="polite">
		<span class="gg-structured-list__spinner" aria-hidden="true"></span>
		Cargando…
	</div>
{:else if data.length === 0}
	{#if empty}
		{@render empty()}
	{:else}
		<div class="gg-structured-list__empty">No hay elementos que mostrar.</div>
	{/if}
{:else}
	<List divided class="gg-structured-list {className}">
		{#each data as row (rowKey ? rowKey(row) : JSON.stringify(row))}
			{@const key = rowKey ? rowKey(row) : ""}
			{@const isSelected = !!selected?.has(key)}
			{@const tint = rowTint?.(row)}
			<ListItem
				class={tint ? "gg-structured-list__item--tinted" : ""}
				style={tint ? `--gg-row-tint: ${tint}` : ""}
				onclick={onRowClick ? () => onRowClick(row) : undefined}
			>
				{#snippet leading()}
					{#if rowKey}
						<Checkbox
							checked={isSelected}
							aria-label="Seleccionar fila"
							onchange={() => toggleSelection(key)}
						/>
					{/if}
				{/snippet}
				<div class="gg-structured-list__row">
					<div class="gg-structured-list__primary">
						{#if primaryColumn?.cell}
							{@render primaryColumn.cell(row)}
						{:else if primaryColumn}
							{cellText(primaryColumn, row)}
						{/if}
					</div>
					{#if secondaryColumns.length}
						<div class="gg-structured-list__fields">
							{#each secondaryColumns as column (column.key)}
								<span class="gg-structured-list__field">
									<span class="gg-structured-list__field-label">{column.label}:</span>
									{#if column.cell}
										{@render column.cell(row)}
									{:else}
										{cellText(column, row)}
									{/if}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				{#snippet trailing()}
					{#if actions?.length}
						<div class="gg-structured-list__actions">
							{#each actions as action (action.label)}
								<button
									type="button"
									class="gg-structured-list__action"
									class:gg-structured-list__action--danger={action.danger}
									disabled={action.disabled?.(row)}
									onclick={(e) => {
										e.stopPropagation();
										action.onclick(row);
									}}
								>
									{action.label}
								</button>
							{/each}
						</div>
					{/if}
				{/snippet}
			</ListItem>
		{/each}
	</List>
{/if}

<style>
	/* v1.7.0 — tinte de identidad por fila (`rowTint`), mismo criterio que DataTable. */
	:global(.gg-list-item.gg-structured-list__item--tinted) {
		background: color-mix(in srgb, var(--gg-row-tint) 8%, var(--surface-raised));
	}

	:global(.gg-list-item.gg-structured-list__item--tinted:hover),
	:global(.gg-list-item.gg-structured-list__item--tinted:focus-within) {
		background: color-mix(in srgb, var(--gg-row-tint) 16%, var(--surface-raised));
	}

	.gg-structured-list__row {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.gg-structured-list__primary {
		color: var(--text-primary);
		font-weight: var(--text-label-weight);
	}

	.gg-structured-list__fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
	}

	.gg-structured-list__field {
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
		color: var(--text-secondary);
	}

	.gg-structured-list__field-label {
		color: var(--text-muted);
		margin-right: var(--space-1);
	}

	.gg-structured-list__actions {
		display: flex;
		gap: var(--space-1);
	}

	.gg-structured-list__action {
		/* --text-interactive, no --interactive-primary: mismo motivo que
		   la acción "danger" de abajo — StructuredList no fija fondo
		   propio (se apoya en el de List, transparente) y se anida a
		   menudo dentro de una Card. --interactive-primary (primary-300
		   dark) pasa AA contra --surface/--surface-sunken pero NO contra
		   --surface-raised (3.87:1, bajo AA) — ver docs/TOKENS.md,
		   "post-ampliación 3". */
		border: none;
		background: transparent;
		color: var(--text-interactive);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
	}

	.gg-structured-list__action:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.gg-structured-list__action:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-structured-list__action--danger {
		/* --text-danger, no --status-danger: StructuredList se usa a
		   menudo dentro de una Card, y --status-danger (danger-300) falla
		   AA como texto contra --surface-raised (4.10:1) — ver
		   docs/TOKENS.md, "post-ampliación 3". */
		color: var(--text-danger);
	}

	.gg-structured-list__empty,
	.gg-structured-list__loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-8);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-structured-list__spinner {
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--radius-full);
		border: 2px solid var(--border-strong);
		border-top-color: var(--text-muted);
		animation: gg-structured-list-spin var(--duration-slow) linear infinite;
	}

	@keyframes gg-structured-list-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-structured-list__spinner {
			animation: none;
		}
	}
</style>
