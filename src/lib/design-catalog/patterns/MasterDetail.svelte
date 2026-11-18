<script lang="ts">
	/**
	 * MasterDetail (§49) — panel maestro (lista) + panel de detalle, uno
	 * al lado del otro cuando hay sitio y colapsados a UN panel con un
	 * botón "Volver" cuando no lo hay. Del catálogo de 4 piezas de §49
	 * (`MasterPane`/`DetailPane`/`ResponsiveMasterDetail`) solo
	 * `MasterDetail` se exporta — ya es "responsive" por sí mismo, mismo
	 * criterio que `AdaptiveDataView` no separó `MobileView`/`TabletView`/
	 * `DesktopView` en piezas propias.
	 *
	 * Nivel decidido por el ANCHO DEL CONTENEDOR (`bind:clientWidth`),
	 * mismo patrón de un solo corte que `AppShell` — por debajo de
	 * `breakpoint` solo cabe un panel a la vez, igual que un teléfono no
	 * puede mostrar lista+detalle lado a lado sin que ambos queden
	 * ilegibles.
	 *
	 * `hasSelection` lo decide el CONSUMIDOR (no `MasterDetail` — no sabe
	 * qué es "una fila seleccionada" en tu dataset), igual que `selected`
	 * en `DataTable` es un `Set` que el consumidor gestiona. En el nivel
	 * ancho, sin selección se pinta `emptyDetail` (p. ej. un
	 * `EmptyState` de Fase 5: "Elige un elemento de la lista").
	 */
	import type { Snippet } from "svelte";
	import { IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";

	interface Props {
		master: Snippet;
		detail: Snippet;
		/** Qué pintar en el panel de detalle (nivel ancho) cuando no hay selección. */
		emptyDetail?: Snippet | undefined;
		hasSelection?: boolean | undefined;
		/** Vuelve al panel maestro en el nivel estrecho. */
		onBack?: (() => void) | undefined;
		masterWidth?: string | undefined;
		/** Ancho de contenedor (px) por debajo del cual solo cabe un panel. */
		breakpoint?: number | undefined;
		backLabel?: string | undefined;
		class?: string | undefined;
	}

	let {
		master,
		detail,
		emptyDetail,
		hasSelection = false,
		onBack,
		masterWidth = "22rem",
		breakpoint = 720,
		backLabel = "Volver a la lista",
		class: className = ""
	}: Props = $props();

	let width = $state(0);
	let tier = $derived(width < breakpoint ? "narrow" : "wide");
</script>

{#snippet backIcon()}
	<Icon
		name="chevron-left"
		size="1em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			body: '<path d="M10 3L5 8l5 5" />'
		}}
	/>
{/snippet}

<div bind:clientWidth={width} class="gg-master-detail gg-master-detail--{tier} {className}" data-tier={tier}>
	{#if tier === "wide"}
		<div class="gg-master-detail__master" style="width:{masterWidth};">
			{@render master()}
		</div>
		<div class="gg-master-detail__detail">
			{#if hasSelection}
				{@render detail()}
			{:else}
				{@render emptyDetail?.()}
			{/if}
		</div>
	{:else if hasSelection}
		<div class="gg-master-detail__narrow-detail">
			<div class="gg-master-detail__back">
				<IconButton label={backLabel} icon={backIcon} variant="ghost" size="sm" onclick={onBack} />
			</div>
			{@render detail()}
		</div>
	{:else}
		{@render master()}
	{/if}
</div>

<style>
	.gg-master-detail {
		box-sizing: border-box;
		display: flex;
		min-height: 0;
		height: 100%;
	}

	.gg-master-detail--narrow {
		flex-direction: column;
	}

	.gg-master-detail__master {
		flex-shrink: 0;
		overflow-y: auto;
		border-right: 1px solid var(--border-subtle);
	}

	.gg-master-detail__detail {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	.gg-master-detail__narrow-detail {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		overflow-y: auto;
	}

	.gg-master-detail__back {
		flex-shrink: 0;
		padding: var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
	}
</style>
