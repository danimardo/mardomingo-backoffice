<script lang="ts">
	/**
	 * Pagination — navegación de páginas para listados grandes (candidato
	 * #1 de la ronda de ampliación post-v0.13.0, ver docs/ROADMAP.md,
	 * pensado para acompañar a `DataTable`/`AdaptiveDataView`, aunque no
	 * depende de ellos — recibe `totalPages` ya calculado, igual que
	 * `FilterBar` recibe `activeFilters` ya calculado).
	 *
	 * `<nav aria-label="Paginación">` + botones normales (no
	 * `role="tablist"`-nada especial: son enlaces/acciones independientes,
	 * cada uno alcanzable por Tab, no un grupo de un único valor con
	 * roving tabindex como `Tabs`/`SegmentedControl` — el patrón ARIA
	 * correcto para paginación es justamente "nada especial", solo
	 * `aria-current="page"` en la página activa). Elipsis (`…`) cuando
	 * hay hueco entre la página actual y los extremos — siempre se ven
	 * primera, última, la actual y sus vecinas inmediatas.
	 */
	import { Icon } from "../icons/index.js";

	interface Props {
		currentPage?: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		/** Tamaño de página opcional — si se pasa junto a `onPageSizeChange`, añade un selector al final. */
		pageSize?: number;
		pageSizeOptions?: number[];
		onPageSizeChange?: (size: number) => void;
		label?: string;
		class?: string;
	}

	let {
		currentPage = $bindable(1),
		totalPages,
		onPageChange,
		pageSize,
		pageSizeOptions = [10, 25, 50, 100],
		onPageSizeChange,
		label = "Paginación",
		class: className = ""
	}: Props = $props();

	type Item = { kind: "page"; page: number } | { kind: "ellipsis" };

	function buildItems(current: number, total: number): Item[] {
		if (total <= 7) {
			return Array.from({ length: total }, (_, i) => ({ kind: "page", page: i + 1 }) as Item);
		}
		const items: Item[] = [{ kind: "page", page: 1 }];
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);
		if (start > 2) items.push({ kind: "ellipsis" });
		for (let p = start; p <= end; p++) items.push({ kind: "page", page: p });
		if (end < total - 1) items.push({ kind: "ellipsis" });
		items.push({ kind: "page", page: total });
		return items;
	}

	function goTo(page: number) {
		const clamped = Math.min(totalPages, Math.max(1, page));
		if (clamped === currentPage) return;
		currentPage = clamped;
		onPageChange(clamped);
	}

	let items = $derived(buildItems(currentPage, totalPages));
</script>

<nav class="gg-pagination {className}" aria-label={label}>
	<button type="button" class="gg-pagination__step" disabled={currentPage <= 1} onclick={() => goTo(currentPage - 1)} aria-label="Página anterior">
		<Icon
			name="chevron-left"
			size="1em"
			legacySvg={{
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				body: '<path d="M10 3l-5 5 5 5" />'
			}}
		/>
	</button>

	<ul class="gg-pagination__list">
		{#each items as item, i (item.kind === "page" ? `p${item.page}` : `e${i}`)}
			<li>
				{#if item.kind === "ellipsis"}
					<span class="gg-pagination__ellipsis" aria-hidden="true">…</span>
				{:else}
					<button
						type="button"
						class="gg-pagination__page"
						class:gg-pagination__page--active={item.page === currentPage}
						aria-current={item.page === currentPage ? "page" : undefined}
						aria-label={`Página ${item.page}`}
						onclick={() => goTo(item.page)}
					>
						{item.page}
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	<button
		type="button"
		class="gg-pagination__step"
		disabled={currentPage >= totalPages}
		onclick={() => goTo(currentPage + 1)}
		aria-label="Página siguiente"
	>
		<Icon
			name="chevron-right"
			size="1em"
			legacySvg={{
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				body: '<path d="M6 3l5 5-5 5" />'
			}}
		/>
	</button>

	{#if pageSize != null && onPageSizeChange}
		<label class="gg-pagination__size">
			<span class="gg-pagination__size-label">Por página</span>
			<select class="gg-pagination__size-select" value={pageSize} onchange={(e) => onPageSizeChange(Number((e.target as HTMLSelectElement).value))}>
				{#each pageSizeOptions as opt (opt)}
					<option value={opt}>{opt}</option>
				{/each}
			</select>
		</label>
	{/if}
</nav>

<style>
	.gg-pagination {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.gg-pagination__list {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.gg-pagination__step,
	.gg-pagination__page {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--space-6);
		height: var(--space-6);
		padding-inline: var(--space-1);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.gg-pagination__step:hover:not(:disabled),
	.gg-pagination__page:hover:not(.gg-pagination__page--active) {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-pagination__step:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.gg-pagination__page--active {
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	.gg-pagination__step:focus-visible,
	.gg-pagination__page:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-pagination__ellipsis {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--space-6);
		height: var(--space-6);
		color: var(--text-muted);
	}

	.gg-pagination__size {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-inline-start: var(--space-2);
	}

	.gg-pagination__size-label {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-pagination__size-select {
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		background: var(--surface);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-pagination__size-select:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-pagination__step,
		.gg-pagination__page {
			transition: none;
		}
	}
</style>
