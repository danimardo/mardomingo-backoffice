<script lang="ts">
	/**
	 * DetailPage (§50) — plantilla de pantalla completa para UN registro:
	 * `PageHeader` (título/breadcrumb/acciones/pestañas) + un estado de
	 * carga (texto + `Spinner`, Fase 5) + el contenido a medida del
	 * consumidor (`children` — normalmente `Card`/`DataCardField` de
	 * Fase 4). A diferencia de `ListPage`, `DetailPage` NO sabe qué forma
	 * tiene "un registro" — no hay un `AdaptiveDataView` que envolver, así
	 * que el cuerpo es un lienzo libre, mismo criterio que separó `Modal`
	 * de `Dialog` en Fase 5.
	 *
	 * `Spinner` aquí es el primer consumidor REAL de la pieza suelta que
	 * introdujo Fase 5 (hasta ahora solo vivía, dibujado a mano, dentro
	 * de `DataTable`/`StructuredList`/`AdaptiveDataView`). El propio
	 * `Spinner` ya lleva `role="status"` + `aria-label={loadingLabel}` —
	 * es su propio anuncio, así que el texto visible de al lado se marca
	 * `aria-hidden` para no duplicarlo (dos regiones anunciando lo mismo
	 * es peor que una sola, no mejor).
	 */
	import type { Snippet } from "svelte";
	import PageHeader from "./PageHeader.svelte";
	import { Spinner } from "../feedback/index.js";
	import type { BreadcrumbItem, TabItem } from "../navigation/index.js";
	import type { ResponsiveActionItem } from "./types.js";

	interface Props {
		title: string;
		subtitle?: string | undefined;
		breadcrumb?: BreadcrumbItem[] | undefined;
		actions?: ResponsiveActionItem[] | undefined;
		tabs?: TabItem[] | undefined;
		tabValue?: string | undefined;
		loading?: boolean | undefined;
		loadingLabel?: string | undefined;
		children?: Snippet | undefined;
		class?: string | undefined;
	}

	let {
		title,
		subtitle,
		breadcrumb,
		actions,
		tabs,
		tabValue = $bindable(),
		loading = false,
		loadingLabel = "Cargando…",
		children,
		class: className = ""
	}: Props = $props();
</script>

<div class="gg-detail-page {className}">
	<PageHeader {title} {subtitle} {breadcrumb} {actions} {tabs} bind:tabValue />
	{#if loading}
		<div class="gg-detail-page__status">
			<Spinner size="md" label={loadingLabel} />
			<span aria-hidden="true">{loadingLabel}</span>
		</div>
	{:else}
		{@render children?.()}
	{/if}
</div>

<style>
	.gg-detail-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.gg-detail-page__status {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8) 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}
</style>
