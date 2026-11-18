<script lang="ts" generics="T">
	/**
	 * DataTable (§18) — un solo componente, no las 22 piezas del catálogo
	 * completo (`TableHeader`/`SortableColumn`/`StickyHeader`/
	 * `ColumnChooser`/`ExportButton`...). `DataTable` cubre lo que
	 * `AdaptiveDataView` necesita compartir con `StructuredList`/
	 * `DataCard` (§17: dataset, selección, orden, acciones, carga, vacío)
	 * con UNA pieza — igual que `Input` cubre 7 tipos con una sola pieza
	 * en Fase 2. Deliberadamente fuera de alcance (ver docs/ROADMAP.md):
	 * columnas reordenables, celdas editables, cabecera/columna fijas
	 * (`sticky`), selector de columnas, y una barra de herramientas/
	 * búsqueda/filtro/exportación aparte — cada una es trabajo real
	 * propio, no un añadido de paso. Columnas redimensionables (ver
	 * `resizeState`/`gg-data-table__resize-handle` más abajo) SÍ entró en
	 * alcance post-entrega, a petición explícita: listados reales con
	 * muchas columnas necesitan poder ajustar el ancho sin editar código.
	 *
	 * `<table>` NATIVO (`<thead>`/`<tbody>`/`<th scope="col">`), no una
	 * rejilla de `<div>`s con ARIA a mano — mismo criterio que
	 * Checkbox/Radio/Switch/Select en Fase 2: la semántica de tabla que
	 * ya entienden los lectores de pantalla (navegación por celda,
	 * anuncio de cabecera de columna) sale gratis y correcta.
	 *
	 * Redimensionado de columnas (`column.resizable`): un tirador en el
	 * borde derecho de la cabecera, manejado con Pointer Events (cubre
	 * ratón/táctil/lápiz con un único listener, sin duplicar lógica touch)
	 * más un atajo de teclado (flecha izq/der con el tirador enfocado,
	 * para quien no puede arrastrar). El ancho resultante se guarda en
	 * `columnWidths` (bindable, por `column.key`) — no en `column.width`,
	 * que sigue siendo el ancho INICIAL declarado por el consumidor; el
	 * ancho mínimo de una columna redimensionable lo impone el CSS
	 * (`min-width: var(--space-16)` en `.gg-data-table__th--resizable`),
	 * nunca un cálculo a mano en JS — así nunca hace falta clamping
	 * manual ni un número de píxeles sin token detrás. El incremento del
	 * atajo de teclado tampoco es un número inventado: se resuelve en
	 * caliente a partir de `--space-4` (ver `resizeStepPx`).
	 */
	import type { Snippet } from "svelte";
	import Checkbox from "../forms/Checkbox.svelte";
	import { Icon } from "../icons/index.js";
	import type { DataColumn, DataAction, RowKey, SortState } from "./types.js";
	import { nextSortState, defaultCompare } from "./types.js";

	interface Props {
		data: T[];
		columns: DataColumn<T>[];
		/** Presente ⇒ se pinta una columna de checkboxes de selección. */
		rowKey?: RowKey<T> | undefined;
		selected?: Set<string> | undefined;
		/** Si se omite, `DataTable` ordena internamente con `defaultCompare` (numérico/alfabético). Pásalo para ordenar tú mismo (p. ej. orden en servidor). */
		sort?: SortState | null | undefined;
		/** Ancho explícito por columna (`column.key` → valor CSS), solo para columnas `resizable` que el usuario ya ha arrastrado o ajustado por teclado. Bindable para que el consumidor pueda persistirlo (p. ej. `localStorage`) y restaurarlo entre sesiones. */
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
		class?: string | undefined;
		style?: string | undefined;
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
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	// Columna cuyo tirador está siendo arrastrado ahora mismo (o null) —
	// solo para dar feedback visual (línea más gruesa/coloreada) mientras
	// dura el gesto; el propio ancho vive en `columnWidths`.
	let resizingKey = $state<string | null>(null);

	/**
	 * Resuelve `--space-4` a píxeles reales en caliente (en vez de asumir
	 * "1rem = 16px") creando un elemento de sonda invisible: funciona sea
	 * cual sea el `font-size` raíz de la página consumidora, y evita
	 * cualquier número de incremento "inventado" sin token detrás.
	 */
	function resizeStepPx(referenceEl: Element): number {
		const doc = referenceEl.ownerDocument;
		const probe = doc.createElement("div");
		probe.style.position = "absolute";
		probe.style.visibility = "hidden";
		probe.style.width = "var(--space-4)";
		doc.body.appendChild(probe);
		const px = probe.getBoundingClientRect().width;
		probe.remove();
		return px || 16;
	}

	function startResize(event: PointerEvent, column: DataColumn<T>) {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		const th = handle.closest("th");
		if (!th) return;
		handle.setPointerCapture(event.pointerId);
		const startX = event.clientX;
		const startWidth = th.getBoundingClientRect().width;
		resizingKey = column.key;
		const previousUserSelect = document.body.style.userSelect;
		document.body.style.userSelect = "none";

		function onMove(e: PointerEvent) {
			const next = startWidth + (e.clientX - startX);
			columnWidths = { ...columnWidths, [column.key]: `${Math.round(next)}px` };
		}
		function onUp(e: PointerEvent) {
			handle.releasePointerCapture(e.pointerId);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
			document.body.style.userSelect = previousUserSelect;
			resizingKey = null;
		}
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	}

	function handleResizeKeydown(event: KeyboardEvent, column: DataColumn<T>) {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		const th = handle.closest("th");
		if (!th) return;
		const step = resizeStepPx(th);
		const current = th.getBoundingClientRect().width;
		const next = event.key === "ArrowRight" ? current + step : current - step;
		columnWidths = { ...columnWidths, [column.key]: `${Math.round(next)}px` };
	}

	let sortedData = $derived.by(() => {
		if (!sort) return data;
		const column = columns.find((c) => c.key === sort!.key);
		if (!column) return data;
		const dir = sort.direction === "asc" ? 1 : -1;
		return [...data].sort((a, b) => {
			const av = (a as Record<string, unknown>)[column.key];
			const bv = (b as Record<string, unknown>)[column.key];
			return defaultCompare(av, bv) * dir;
		});
	});

	let allKeys = $derived(rowKey ? data.map(rowKey) : []);
	let allSelected = $derived(allKeys.length > 0 && allKeys.every((k) => selected.has(k)));
	let someSelected = $derived(!allSelected && allKeys.some((k) => selected.has(k)));

	function cellText(column: DataColumn<T>, row: T): string {
		const value = (row as Record<string, unknown>)[column.key];
		return value == null ? "" : String(value);
	}

	function toggleSort(column: DataColumn<T>) {
		if (!column.sortable) return;
		sort = nextSortState(sort, column.key);
	}

	function toggleRow(key: string) {
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(allKeys);
	}

	function ariaSort(column: DataColumn<T>): "ascending" | "descending" | "none" {
		if (!column.sortable) return "none";
		if (sort?.key !== column.key) return "none";
		return sort.direction === "asc" ? "ascending" : "descending";
	}
</script>

<div class="gg-data-table-wrap {className}" style={styleProp}>
	{#if loading}
		<div class="gg-data-table__status" role="status" aria-live="polite">
			<span class="gg-data-table__spinner" aria-hidden="true"></span>
			Cargando…
		</div>
	{:else if data.length === 0}
		{#if empty}
			{@render empty()}
		{:else}
			<div class="gg-data-table__status">No hay elementos que mostrar.</div>
		{/if}
	{:else}
		<table class="gg-data-table">
			<thead>
				<tr>
					{#if rowKey}
						<th class="gg-data-table__select-col">
							<Checkbox checked={allSelected} indeterminate={someSelected} aria-label="Seleccionar todo" onchange={toggleAll} />
						</th>
					{/if}
					{#each columns as column (column.key)}
						{@const widthValue = columnWidths[column.key] ?? column.width}
						<th
							scope="col"
							aria-sort={ariaSort(column)}
							class:gg-data-table__th--resizable={column.resizable}
							style={widthValue ? `width:${widthValue};` : ""}
						>
							{#if column.sortable}
								<button type="button" class="gg-data-table__sort-btn" onclick={() => toggleSort(column)}>
									{column.label}
									<Icon
										name="sort-indicator"
										tone={sort?.key === column.key ? "primary" : "neutral"}
										class={[
											"gg-data-table__sort-icon",
											sort?.key === column.key ? "gg-data-table__sort-icon--active" : "",
											sort?.key === column.key && sort.direction === "desc" ? "gg-data-table__sort-icon--desc" : ""
										]
											.filter(Boolean)
											.join(" ")}
										size={10}
										legacySvg={{
											viewBox: "0 0 12 12",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "1.6",
											body: '<path d="M3 4.5L6 7.5L9 4.5" />'
										}}
									/>
								</button>
							{:else}
								{column.label}
							{/if}
							{#if column.resizable}
								<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<!--
									Patrón "window splitter" de WAI-ARIA APG: un `role="separator"`
									enfocable (tabindex) con listeners propios es el patrón
									estándar para un tirador de redimensión — no hay elemento
									nativo HTML equivalente, igual que MenuSeparator/
									DesktopToolbar ya usan `role="separator"` (sin interacción,
									ahí sí) en vez de un `<hr>` para separadores no documentales.
									El linter de Svelte no reconoce todavía este patrón como
									"interactivo", de ahí el `svelte-ignore` explícito.
								-->
								<div
									class="gg-data-table__resize-handle"
									class:gg-data-table__resize-handle--active={resizingKey === column.key}
									role="separator"
									aria-orientation="vertical"
									aria-label={`Redimensionar columna ${column.label} (arrastrar, o flecha izquierda/derecha)`}
									tabindex="0"
									onpointerdown={(e) => startResize(e, column)}
									onkeydown={(e) => handleResizeKeydown(e, column)}
								></div>
							{/if}
						</th>
					{/each}
					{#if actions?.length}
						<th class="gg-data-table__actions-col"><span class="gg-data-table__visually-hidden">Acciones</span></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each sortedData as row (rowKey ? rowKey(row) : JSON.stringify(row))}
					{@const key = rowKey ? rowKey(row) : ""}
					{@const tint = rowTint?.(row)}
					<tr
						class:gg-data-table__row--tinted={!!tint}
						style:--gg-row-tint={tint}
						class:gg-data-table__row--interactive={!!onRowClick}
						class:gg-data-table__row--selected={rowKey && selected.has(key)}
						onclick={onRowClick ? () => onRowClick(row) : undefined}
					>
						{#if rowKey}
							<td class="gg-data-table__select-col">
								<Checkbox
									checked={selected.has(key)}
									aria-label="Seleccionar fila"
									onclick={(e: MouseEvent) => e.stopPropagation()}
									onchange={() => toggleRow(key)}
								/>
							</td>
						{/if}
						{#each columns as column (column.key)}
							<td class="gg-data-table__cell--{column.align ?? 'start'}">
								{#if column.cell}
									{@render column.cell(row)}
								{:else}
									{cellText(column, row)}
								{/if}
							</td>
						{/each}
						{#if actions?.length}
							<td class="gg-data-table__actions-col">
								<div class="gg-data-table__actions">
									{#each actions as action (action.label)}
										<button
											type="button"
											class="gg-data-table__action"
											class:gg-data-table__action--danger={action.danger}
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
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.gg-data-table-wrap {
		width: 100%;
		overflow-x: auto;
	}

	.gg-data-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-data-table thead th {
		text-align: left;
		padding: var(--space-3) var(--space-4);
		color: var(--text-muted);
		font-weight: var(--text-label-weight);
		font-size: var(--text-caption-size);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.gg-data-table tbody td {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-primary);
	}

	.gg-data-table tbody tr:last-child td {
		border-bottom: none;
	}

	.gg-data-table__cell--center {
		text-align: center;
	}

	.gg-data-table__cell--end {
		text-align: right;
	}

	.gg-data-table__row--interactive {
		cursor: pointer;
	}

	.gg-data-table__row--interactive:hover {
		background: var(--surface-sunken);
	}

	/* v1.7.0 — tinte de identidad por fila (`rowTint`). Mezcla con la
	   superficie para que el texto conserve su contraste (≥4,5:1 con los
	   12 colores, comprobado en generate-tokens.mjs). */
	.gg-data-table__row--tinted {
		background: color-mix(in srgb, var(--gg-row-tint) 8%, var(--surface-raised));
	}

	.gg-data-table__row--tinted:hover,
	.gg-data-table__row--tinted:focus-within {
		background: color-mix(in srgb, var(--gg-row-tint) 16%, var(--surface-raised));
	}

	.gg-data-table__row--selected {
		background: color-mix(in srgb, var(--surface-button-primary) 8%, transparent);
	}

	.gg-data-table__select-col,
	.gg-data-table__actions-col {
		width: var(--space-10);
	}

	.gg-data-table__sort-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border: none;
		background: transparent;
		padding: 0;
		margin: calc(var(--space-1) * -1) 0;
		color: inherit;
		font: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		cursor: pointer;
	}

	.gg-data-table__sort-btn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	:global(.gg-data-table__sort-icon) {
		opacity: 0;
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-data-table__sort-btn:hover :global(.gg-data-table__sort-icon),
	:global(.gg-data-table__sort-icon--active) {
		opacity: 1;
	}

	:global(.gg-data-table__sort-icon--desc) {
		transform: rotate(180deg);
	}

	.gg-data-table__th--resizable {
		position: relative;
		/* Único freno al ancho mínimo — ningún número de píxeles
		   calculado a mano en el JS de arrastre/teclado, ver cabecera. */
		min-width: var(--space-16);
	}

	.gg-data-table__resize-handle {
		/* Dentro del propio <th> (right:0, no un offset negativo que lo
		   saque de su caja): con border-collapse:collapse la línea de
		   borde compartida entre dos <th> contiguos la pinta el propio
		   navegador en una pasada aparte que puede quedar POR ENCIMA de
		   contenido que sobresale de su celda — un tirador a caballo
		   entre columnas (right negativo) quedaba tapado justo en el
		   punto central por esa línea de borde, inconsistente entre
		   columnas según el ancho exacto. Totalmente dentro de la celda,
		   el tirador nunca compite con esa pasada de borde. */
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0;
		width: var(--space-4);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: col-resize;
		touch-action: none;
		background: transparent;
		border: none;
		padding: 0;
	}

	.gg-data-table__resize-handle::after {
		content: "";
		width: 1px;
		height: var(--space-4);
		background: var(--border-strong);
	}

	.gg-data-table__resize-handle:hover::after,
	.gg-data-table__resize-handle--active::after {
		width: 2px;
		background: var(--interactive-primary);
	}

	.gg-data-table__resize-handle:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-data-table__actions {
		display: flex;
		gap: var(--space-1);
		justify-content: flex-end;
	}

	.gg-data-table__action {
		/* --text-interactive, no --interactive-primary: mismo motivo que
		   la acción "danger" de abajo — DataTable no fija fondo propio
		   (hereda el de su contenedor) y se anida a menudo dentro de una
		   Card. --interactive-primary (primary-300 dark) pasa AA contra
		   --surface/--surface-sunken pero NO contra --surface-raised
		   (3.87:1, bajo AA) — ver docs/TOKENS.md, "post-ampliación 3". */
		border: none;
		background: transparent;
		color: var(--text-interactive);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
	}

	.gg-data-table__action:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.gg-data-table__action:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-data-table__action--danger {
		/* --text-danger, no --status-danger: DataTable se usa a menudo
		   dentro de una Card, y --status-danger (danger-300) falla AA
		   como texto contra --surface-raised (4.10:1) — ver
		   docs/TOKENS.md, "post-ampliación 3". */
		color: var(--text-danger);
	}

	.gg-data-table__visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.gg-data-table__status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-8);
		color: var(--text-muted);
		font-size: var(--text-body-sm-size);
	}

	.gg-data-table__spinner {
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--radius-full);
		border: 2px solid var(--border-strong);
		border-top-color: var(--text-muted);
		animation: gg-data-table-spin var(--duration-slow) linear infinite;
	}

	@keyframes gg-data-table-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-data-table__spinner {
			animation: none;
		}
		.gg-data-table__sort-icon {
			transition: none;
		}
	}
</style>
