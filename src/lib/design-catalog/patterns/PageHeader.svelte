<script lang="ts">
	/**
	 * PageHeader (§51) — cabecera de página: breadcrumb + título/subtítulo
	 * + acciones (degradadas con `ResponsiveActions`) + pestañas. Del
	 * catálogo de 6 piezas de §51 (`PageTitle`/`PageSubtitle`/
	 * `PageActions`/`PageTabs`/`PageBreadcrumb`) solo `PageHeader` se
	 * exporta — las demás son las PROPS de esta única pieza, mismo
	 * criterio que `FormField` (Fase 2) no exporta un componente aparte
	 * por cada trozo que compone.
	 *
	 * Base de `ListPage`/`DetailPage`/`CRUDPage` (Fase 6): las tres
	 * reciben literalmente las mismas props de cabecera y se las pasan a
	 * `PageHeader` tal cual, igual que `columns`/`data`/`rowKey` viajan
	 * sin remapear entre `StructuredList`/`DataTable`/`AdaptiveDataView`
	 * en Fase 4.
	 *
	 * Decisión de alcance sobre `tabs`: `PageHeader` solo dibuja la TIRA
	 * de pestañas (`Tabs` sin `children`) — emparejarla con `TabPanel`
	 * exigiría que los paneles vivieran dentro del mismo árbol de
	 * componentes que `Tabs` (contexto de Svelte, ver `Tabs.svelte`), lo
	 * que obligaría a que TODO el cuerpo de la página fuera "hijo" de la
	 * cabecera. En vez de eso, el consumidor liga `tabValue` (bindable) a
	 * su propio contenido condicional en el cuerpo de la página, o anida
	 * `<Tabs>`/`<TabPanel>` aparte si quiere las relaciones ARIA
	 * panel-por-panel — mismo criterio de "no forzar una forma de árbol"
	 * que ya separaba `ToastStack` de `createToastStore()` en Fase 5.
	 */
	import { Heading, Text } from "../typography/index.js";
	import { Breadcrumb, Tabs } from "../navigation/index.js";
	import type { BreadcrumbItem, TabItem } from "../navigation/index.js";
	import ResponsiveActions from "./ResponsiveActions.svelte";
	import type { ResponsiveActionItem } from "./types.js";
	import type { ButtonSize } from "../buttons/index.js";

	interface Props {
		title: string;
		subtitle?: string | undefined;
		breadcrumb?: BreadcrumbItem[] | undefined;
		actions?: ResponsiveActionItem[] | undefined;
		tabs?: TabItem[] | undefined;
		tabValue?: string | undefined;
		actionsSize?: ButtonSize | undefined;
		/** v1.9.0 — filete de marca bajo el título: el degradado corporativo azul-naranja (decorativo, `aria-hidden`). */
		brandRule?: boolean | undefined;
		class?: string | undefined;
	}

	let {
		title,
		subtitle,
		breadcrumb,
		actions,
		tabs,
		tabValue = $bindable(),
		actionsSize = "sm",
		brandRule = false,
		class: className = ""
	}: Props = $props();
</script>

<header class="gg-page-header {className}">
	{#if breadcrumb && breadcrumb.length}
		<Breadcrumb items={breadcrumb} />
	{/if}
	<div class="gg-page-header__row">
		<div class="gg-page-header__titles">
			<Heading level={1} step="h2">{title}</Heading>
			{#if brandRule}
				<span class="bc-gradient-rule gg-page-header__rule" aria-hidden="true"></span>
			{/if}
			{#if subtitle}
				<Text step="body-sm" tone="secondary" as="p">{subtitle}</Text>
			{/if}
		</div>
		{#if actions && actions.length}
			<ResponsiveActions {actions} size={actionsSize} class="gg-page-header__actions" />
		{/if}
	</div>
	{#if tabs && tabs.length}
		<Tabs items={tabs} bind:value={tabValue} class="gg-page-header__tabs" />
	{/if}
</header>

<style>
	.gg-page-header__rule {
		width: var(--space-16);
	}

	.gg-page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.gg-page-header__row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.gg-page-header__titles {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	:global(.gg-page-header__actions) {
		flex-shrink: 0;
	}
</style>
