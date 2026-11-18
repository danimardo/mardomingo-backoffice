<script lang="ts">
	/**
	 * DataCard (§19) — un `Card` que representa UN registro (la
	 * representación "Mobile" de `AdaptiveDataView`), con checkbox de
	 * selección opcional.
	 *
	 * Alcance deliberado (ver docs/ROADMAP.md): del catálogo de 7 piezas
	 * de §19, solo se construyen aquí las dos que de verdad son nuevas —
	 * `DataCardField` (fila etiqueta/valor) y `DataCardStatus` (indicador
	 * de estado). `DataCardHeader`/`DataCardContent`/`DataCardFooter`/
	 * `DataCardActions` serían casi idénticas a `CardHeader`/`CardBody`/
	 * `CardFooter`/`CardActions` ya construidas — se reutilizan esas en
	 * vez de duplicar cuatro componentes casi iguales (§65: "evitar
	 * componentes monolíticos" corta también hacia evitar la
	 * proliferación de piezas redundantes).
	 */
	import type { Snippet } from "svelte";
	import Card from "./Card.svelte";
	import Checkbox from "../forms/Checkbox.svelte";
	import type { ElevationToken, RadiusToken } from "../primitives/types.js";

	interface Props {
		/** Si se da `onSelectChange`, la tarjeta muestra un checkbox de selección. */
		selected?: boolean;
		onSelectChange?: ((selected: boolean) => void) | undefined;
		/** Nombre accesible del checkbox — no hay texto visible que lo sustituya (mismo motivo que `IconButton.label`). */
		selectLabel?: string;
		elevation?: ElevationToken;
		radius?: RadiusToken;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		selected = false,
		onSelectChange,
		selectLabel = "Seleccionar",
		elevation = "raised",
		radius = "lg",
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();
</script>

<Card {elevation} {radius} class="gg-data-card {className}" style={styleProp}>
	{#if onSelectChange}
		<div class="gg-data-card__row">
			<Checkbox
				checked={selected}
				aria-label={selectLabel}
				onchange={(e: Event) => onSelectChange?.((e.currentTarget as HTMLInputElement).checked)}
				class="gg-data-card__select"
			/>
			<div class="gg-data-card__content">
				{@render children?.()}
			</div>
		</div>
	{:else}
		{@render children?.()}
	{/if}
</Card>

<style>
	.gg-data-card__row {
		display: flex;
		align-items: flex-start;
	}

	/* :global() — la clase se pasa a Checkbox (componente hijo), no a un
	   elemento de esta plantilla; sin :global() el compilador de Svelte
	   la marca como "selector sin uso" porque no puede ver a través del
	   límite del componente. */
	:global(.gg-data-card__select) {
		padding: var(--space-5) 0 var(--space-5) var(--space-5);
	}

	.gg-data-card__content {
		flex: 1;
		min-width: 0;
	}
</style>
