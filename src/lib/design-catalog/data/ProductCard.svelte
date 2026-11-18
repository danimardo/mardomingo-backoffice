<script lang="ts">
	/**
	 * ProductCard (ampliación 3, §20 — otra de las 13 variantes de
	 * `Card` dejadas fuera en Fase 4, ya reducidas por `StatCard`/
	 * `ActionCard` en ampliación 1 y `SelectionCard` en ampliación 2) —
	 * SÍ envuelve `Card`/`CardMedia`/`CardBody`/`CardFooter`/
	 * `CardActions` (a diferencia de `ActionCard`/`SelectionCard`, que
	 * construyen su propia raíz porque necesitaban `...rest`/semántica de
	 * botón que `Surface`/`Card` no exponen) — `ProductCard` NO es
	 * clicable como un todo (a diferencia de `ActionCard`), es una
	 * composición de contenido NORMAL con una disposición fija
	 * (imagen/insignia, título, precio, descripción, acciones), así que
	 * reutilizar la familia `Card` entera es exactamente el caso para el
	 * que existe.
	 *
	 * `price` se recibe ya FORMATEADO por el consumidor (`string`, p. ej.
	 * `"49,90 €"`), no como número — este paquete no asume moneda ni
	 * configuración regional, mismo criterio que `StatCard.value` acepta
	 * `string | number` sin intentar dar formato él mismo.
	 *
	 * Las variantes restantes del catálogo completo (`MetricCard`,
	 * `ProfileCard`, `PricingCard`...) NO se construyen como piezas
	 * propias — son composiciones directas de `Card`/`CardMedia`/
	 * `CardBody`/`CardFooter`/`CardActions` sin ningún comportamiento o
	 * token nuevo que codificar una sola vez (a diferencia de
	 * `ProductCard`: precio + insignia + disposición fija sí son una
	 * decisión que vale la pena tomar una vez); ver el ejemplo de
	 * composición en `docs/COMPONENTS.md` y el porqué completo en
	 * `docs/ROADMAP.md`.
	 */
	import type { Snippet } from "svelte";
	import Card from "./Card.svelte";
	import CardMedia from "./CardMedia.svelte";
	import CardBody from "./CardBody.svelte";
	import CardFooter from "./CardFooter.svelte";
	import CardActions from "./CardActions.svelte";

	interface Props {
		title: string;
		/** Ya formateado por el consumidor — ver la nota de cabecera. */
		price: string;
		description?: string;
		/** Contenido de `CardMedia` (normalmente una `<img>`). */
		media?: Snippet;
		/** p. ej. "Nuevo", "-20%" — decorativo, nunca el único portador de significado (el precio en texto ya lo es). */
		badge?: string;
		/** Normalmente un `<Button>` ("Añadir al carrito") — el paquete no impone texto ni comportamiento. */
		actions?: Snippet;
		class?: string;
	}

	let { title, price, description, media, badge, actions, class: className = "" }: Props = $props();
</script>

<Card class="gg-product-card {className}">
	{#if media}
		<div class="gg-product-card__media-wrap">
			<CardMedia aspectRatio="4/3">{@render media()}</CardMedia>
			{#if badge}
				<span class="gg-product-card__badge">{badge}</span>
			{/if}
		</div>
	{/if}
	<CardBody>
		<p class="gg-product-card__title">{title}</p>
		<p class="gg-product-card__price">{price}</p>
		{#if description}
			<p class="gg-product-card__description">{description}</p>
		{/if}
	</CardBody>
	{#if actions}
		<CardFooter>
			<CardActions justify="start">
				{@render actions()}
			</CardActions>
		</CardFooter>
	{/if}
</Card>

<style>
	/* `:global`: esta clase se pasa como prop a `<Card>` y termina en el
	   `<Surface>` que `Card` renderiza — no en un elemento del propio
	   template de `ProductCard`, así que el análisis de CSS con ámbito de
	   Svelte no puede verla usada sin `:global` (mismo motivo que
	   `.gg-menu.gg-mega-menu__menu` en `MegaMenu.svelte`). */
	:global(.gg-product-card) {
		display: flex;
		flex-direction: column;
	}

	.gg-product-card__media-wrap {
		position: relative;
	}

	.gg-product-card__badge {
		position: absolute;
		top: var(--space-2);
		left: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-caption-leading);
	}

	.gg-product-card__title {
		margin: 0 0 var(--space-1);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-product-card__price {
		margin: 0 0 var(--space-2);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-h6-size);
		font-weight: var(--text-h6-weight);
		line-height: var(--text-h6-leading);
	}

	.gg-product-card__description {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}
</style>
