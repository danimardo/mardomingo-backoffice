<script lang="ts">
	/**
	 * Grid — CSS grid (§8.3). `columns` fija un número fijo de columnas
	 * iguales; `minColumnWidth` en su lugar genera una rejilla que se
	 * auto-rellena y envuelve sola (`repeat(auto-fill, minmax(...))`) —
	 * la forma recomendada por la especificación (§4.3, §17) de conseguir
	 * "adaptativo de verdad" sin escribir breakpoints a mano. `container`
	 * activa `container-type: inline-size` para que los HIJOS puedan usar
	 * `@container` sobre el ancho de esta rejilla en vez del viewport.
	 */
	import type { Snippet } from "svelte";
	import type { RadiusToken, SpaceToken } from "./types.js";
	import { spaceVar, containerStyle } from "./types.js";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
		/** Número fijo de columnas iguales. Ignorado si se pasa `minColumnWidth`. */
		columns?: number;
		/** Ancho mínimo por columna — activa auto-fill/minmax en vez de `columns`. */
		minColumnWidth?: string;
		gap?: SpaceToken;
		columnGap?: SpaceToken;
		rowGap?: SpaceToken;
		padding?: SpaceToken;
		radius?: RadiusToken;
		container?: boolean | string;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		as = "div",
		columns,
		minColumnWidth,
		gap,
		columnGap,
		rowGap,
		padding,
		radius,
		container,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let templateColumns = $derived(
		minColumnWidth
			? `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`
			: columns !== undefined
				? `repeat(${columns}, minmax(0, 1fr))`
				: undefined
	);

	let inlineStyle = $derived(
		[
			"display:grid;",
			templateColumns ? `grid-template-columns:${templateColumns};` : "",
			gap !== undefined ? `gap:${spaceVar(gap)};` : "",
			columnGap !== undefined ? `column-gap:${spaceVar(columnGap)};` : "",
			rowGap !== undefined ? `row-gap:${spaceVar(rowGap)};` : "",
			padding !== undefined ? `padding:${spaceVar(padding)};` : "",
			radius !== undefined ? `border-radius:var(--radius-${radius});` : "",
			containerStyle(container),
			styleProp
		].join("")
	);
</script>

<svelte:element this={as} class="gg-grid {className}" style={inlineStyle}>
	{@render children?.()}
</svelte:element>

<style>
	.gg-grid {
		box-sizing: border-box;
		min-width: 0;
	}
</style>
