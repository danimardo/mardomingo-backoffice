<script lang="ts">
	/**
	 * FilterBar (§30) — barra de filtros: una fila para los CONTROLES de
	 * filtro (el consumidor los compone como `children` — `Select`,
	 * `Input`, `DropdownMenu`... de fases anteriores, `FilterBar` no
	 * impone qué tipo de filtro existe) más, debajo, los filtros YA
	 * activos como chips descartables + "Limpiar todo".
	 *
	 * Del catálogo de 9 piezas de §30 (`FilterChip`/`FilterGroup`/
	 * `FilterDropdown`/`AdvancedFilters`/`FilterPanel`/`FilterDrawer`/
	 * `FilterBottomSheet`/`ActiveFilters`) solo `FilterBar` está en la
	 * lista curada de Fase 6 (§69) — el chip descartable se pinta POR
	 * DENTRO de `FilterBar`, sin exportarse como pieza propia, mismo
	 * criterio que el punto de `DataCardStatus` no se exportó aparte de
	 * `DataCard` hasta que hizo falta (Fase 4).
	 *
	 * Sin estado propio: `activeFilters` llega ya calculado por el
	 * consumidor (igual que `ToastStack` recibe `toasts` en vez de
	 * gestionarlos) — `FilterBar` no sabe qué es "un filtro", solo pinta
	 * la lista que le pasan y llama a `onRemove`/`onClearAll`.
	 */
	import type { Snippet } from "svelte";
	import { Button, IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";
	import type { FilterBarChip } from "./types.js";

	interface Props {
		activeFilters?: FilterBarChip[] | undefined;
		onClearAll?: (() => void) | undefined;
		clearAllLabel?: string | undefined;
		children?: Snippet | undefined;
		class?: string | undefined;
	}

	let { activeFilters = [], onClearAll, clearAllLabel = "Limpiar todo", children, class: className = "" }: Props = $props();
</script>

{#snippet closeIcon()}
	<Icon
		name="x"
		size="0.75em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			body: '<path d="M4 4l8 8M12 4l-8 8" />'
		}}
	/>
{/snippet}

<div class="gg-filter-bar {className}">
	{#if children}
		<div class="gg-filter-bar__controls">
			{@render children()}
		</div>
	{/if}
	{#if activeFilters.length > 0}
		<div class="gg-filter-bar__active" role="list" aria-label="Filtros activos">
			{#each activeFilters as chip (chip.key)}
				<span class="gg-filter-bar__chip" role="listitem">
					<span class="gg-filter-bar__chip-label">{chip.label}</span>
					<IconButton
						label={`Quitar filtro «${chip.label}»`}
						icon={closeIcon}
						size="sm"
						variant="ghost"
						class="gg-filter-bar__chip-remove"
						onclick={chip.onRemove}
					/>
				</span>
			{/each}
			{#if onClearAll}
				<Button variant="ghost" size="sm" onclick={onClearAll}>{clearAllLabel}</Button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.gg-filter-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.gg-filter-bar__controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.gg-filter-bar__active {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.gg-filter-bar__chip {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	:global(.gg-filter-bar__chip-remove) {
		flex-shrink: 0;
	}
</style>
