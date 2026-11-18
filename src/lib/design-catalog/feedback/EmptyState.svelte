<script lang="ts">
	/**
	 * EmptyState (§25) — del catálogo de 11 piezas (`NoResults`/
	 * `FirstUseState`/`ErrorState`/`OfflineState`/`PermissionDenied`/
	 * `NotFoundState`/`MaintenanceState`/`NetworkError`/`ServerError`/
	 * `RetryPanel`) solo se construye la genérica: todas las demás son la
	 * MISMA composición (icono + título + descripción + acción) con
	 * contenido distinto, no un patrón propio — se cubren pasando el
	 * icono/texto/acción que corresponda, igual que `Input` cubre 7
	 * variantes de teclado con una sola pieza (Fase 2).
	 *
	 * Pensado para encajar en el slot `empty` ya existente en
	 * `DataTable`/`StructuredList`/`AdaptiveDataView` (Fase 4) — esos
	 * componentes ya aceptaban un `Snippet` ahí desde que se
	 * construyeron, con un texto plano de repuesto; `EmptyState` es la
	 * pieza que de verdad se les pasa en un consumidor real.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		/** Icono o ilustración — decorativo (`aria-hidden`), el título ya comunica el estado. */
		icon?: Snippet;
		title: string;
		description?: string;
		actions?: Snippet;
		class?: string;
	}

	let { icon, title, description, actions, class: className = "" }: Props = $props();
</script>

<div class="gg-empty-state {className}">
	{#if icon}
		<div class="gg-empty-state__icon" aria-hidden="true">{@render icon()}</div>
	{/if}
	<p class="gg-empty-state__title">{title}</p>
	{#if description}
		<p class="gg-empty-state__description">{description}</p>
	{/if}
	{#if actions}
		<div class="gg-empty-state__actions">{@render actions()}</div>
	{/if}
</div>

<style>
	.gg-empty-state {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-10) var(--space-6);
	}

	.gg-empty-state__icon {
		display: inline-flex;
		width: var(--space-12);
		height: var(--space-12);
		align-items: center;
		justify-content: center;
		color: var(--text-disabled);
		margin-bottom: var(--space-2);
	}

	.gg-empty-state__title {
		margin: 0;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}

	.gg-empty-state__description {
		margin: 0;
		max-width: var(--overlay-width-sm);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-empty-state__actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
</style>
