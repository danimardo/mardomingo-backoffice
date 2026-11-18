<script lang="ts">
	/**
	 * ResponsiveActions (§54) — degrada una barra de acciones
	 * progresivamente según el ancho del CONTENEDOR (no el viewport),
	 * mismo patrón `bind:clientWidth` + niveles que `AdaptiveDataView`
	 * (Fase 4):
	 *
	 *   Desktop  [Editar] [Exportar] [Duplicar] [Eliminar]
	 *   Tablet   [Editar] [Exportar] [⋮]
	 *   Mobile   [Editar] [⋮]
	 *
	 * El ORDEN de `actions` es la prioridad — la primera sobrevive más
	 * tiempo al estrechar. Base de `PageHeader`/`ListPage`/`DetailPage`/
	 * `CRUDPage`, que reciben el mismo `ResponsiveActionItem[]` y se lo
	 * pasan tal cual.
	 *
	 * Decisión de alcance: NO se mide el ancho real de cada botón para
	 * decidir cuántos caben (exigiría una pasada de medición oculta o un
	 * `ResizeObserver` por botón) — en vez de eso, `desktopVisible`/
	 * `tabletVisible`/`mobileVisible` fijan explícitamente cuántas
	 * acciones se ven como botón en cada nivel, con el resto siempre en el
	 * menú "⋮" (`DropdownMenu`+`MenuItem`, Fase 3). Misma simplificación
	 * deliberada que los `tabletBreakpoint`/`desktopBreakpoint` explícitos
	 * de `AdaptiveDataView` en vez de un cálculo automático de columnas.
	 *
	 * Nota de contraste: el texto de una acción `danger` usa
	 * `--text-danger` (no `--status-danger`, que `DataTable`/
	 * `StructuredList`/`FormError`/`RequiredIndicator` también usaban
	 * antes de esta corrección — ver docs/TOKENS.md, "post-ampliación
	 * 3"), así que pasa AA sin importar si `ResponsiveActions` vive en
	 * un `PageHeader` sobre `--surface` o dentro de una superficie
	 * elevada (`--surface-raised`) — a diferencia de `Tabs`/`Sidebar`/
	 * `Menu` (Fase 3), que sí siguen atados a `--surface` porque usan
	 * `--interactive-primary` como texto, un tono distinto que no se ha
	 * revisado en este barrido.
	 */
	import { DropdownMenu, MenuItem } from "../navigation/index.js";
	import { Button, IconButton } from "../buttons/index.js";
	import type { ButtonSize } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";
	import type { ResponsiveActionItem } from "./types.js";
	// Ver la nota equivalente en AdaptiveDataView.svelte — mismo espejo
	// BREAKPOINT_CONTAINER_PX, ronda de ampliación UX post-v0.14.0.
	import { BREAKPOINT_CONTAINER_PX } from "../tokens/index.js";

	interface Props {
		actions: ResponsiveActionItem[];
		/** Nº de acciones visibles como botón en el nivel Desktop. Por defecto, todas. */
		desktopVisible?: number | undefined;
		/** Nº de acciones visibles como botón en el nivel Tablet. */
		tabletVisible?: number | undefined;
		/** Nº de acciones visibles como botón en el nivel Mobile. */
		mobileVisible?: number | undefined;
		/** Ancho de contenedor (px) a partir del cual pasa de Mobile a Tablet. */
		tabletBreakpoint?: number | undefined;
		/** Ancho de contenedor (px) a partir del cual pasa a Desktop. */
		desktopBreakpoint?: number | undefined;
		/** Nombre accesible del disparador del menú de desbordamiento. */
		moreLabel?: string | undefined;
		size?: ButtonSize | undefined;
		class?: string | undefined;
	}

	let {
		actions,
		desktopVisible,
		tabletVisible = 2,
		mobileVisible = 1,
		tabletBreakpoint = BREAKPOINT_CONTAINER_PX.sm,
		desktopBreakpoint = BREAKPOINT_CONTAINER_PX.lg,
		moreLabel = "Más acciones",
		size = "sm",
		class: className = ""
	}: Props = $props();

	let width = $state(0);

	let tier = $derived(width >= desktopBreakpoint ? "desktop" : width >= tabletBreakpoint ? "tablet" : "mobile");

	let visibleCount = $derived(
		Math.min(
			actions.length,
			tier === "desktop" ? (desktopVisible ?? actions.length) : tier === "tablet" ? tabletVisible : mobileVisible
		)
	);

	let visible = $derived(actions.slice(0, visibleCount));
	let overflow = $derived(actions.slice(visibleCount));
</script>

{#snippet moreIcon()}
	<Icon
		name="ellipsis-vertical"
		size="1em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "currentColor",
			body: '<circle cx="8" cy="3" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="8" cy="13" r="1.3" />'
		}}
	/>
{/snippet}

<div bind:clientWidth={width} class="gg-responsive-actions {className}" data-tier={tier}>
	{#each visible as action (action.label)}
		<Button
			variant="secondary"
			{size}
			disabled={action.disabled}
			icon={action.icon}
			style={action.danger ? "color:var(--text-danger);" : ""}
			onclick={action.onclick}
		>
			{action.label}
		</Button>
	{/each}
	{#if overflow.length > 0}
		<DropdownMenu placement="bottom-end">
			{#snippet trigger({ triggerProps })}
				<IconButton label={moreLabel} icon={moreIcon} variant="secondary" {size} {...triggerProps} />
			{/snippet}
			{#each overflow as action (action.label)}
				<MenuItem disabled={action.disabled} danger={action.danger} icon={action.icon} onclick={action.onclick}>
					{action.label}
				</MenuItem>
			{/each}
		</DropdownMenu>
	{/if}
</div>

<style>
	.gg-responsive-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: nowrap;
	}
</style>
