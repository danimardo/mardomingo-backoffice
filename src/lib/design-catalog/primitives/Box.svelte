<script lang="ts">
	/**
	 * Box — el primitivo raíz de layout (§8.1). Un <div> (o el elemento que
	 * se indique en `as`) con acceso directo, vía props, a las escalas de
	 * espaciado/radio de tokens.css — para que "padding: 16px" nunca se
	 * escriba suelto en un componente de más arriba.
	 *
	 * Todo lo que no cubre una prop tipada se pasa por `class` (utilidades
	 * de Tailwind) o `style` (para casos que ninguna de las dos cubra) —
	 * Box no intenta ser exhaustivo, solo evitar que el 90% de los casos
	 * necesite CSS a mano.
	 */
	import type { Snippet } from "svelte";
	import type { RadiusToken, SpaceToken } from "./types.js";
	import { spaceVar, containerStyle } from "./types.js";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
		padding?: SpaceToken;
		paddingX?: SpaceToken;
		paddingY?: SpaceToken;
		margin?: SpaceToken;
		radius?: RadiusToken;
		/** Activa `container-type: inline-size` (§4.3) para @container hijos. */
		container?: boolean | string;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		as = "div",
		padding,
		paddingX,
		paddingY,
		margin,
		radius,
		container,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let inlineStyle = $derived(
		[
			padding !== undefined ? `padding:${spaceVar(padding)};` : "",
			paddingX !== undefined ? `padding-left:${spaceVar(paddingX)};padding-right:${spaceVar(paddingX)};` : "",
			paddingY !== undefined ? `padding-top:${spaceVar(paddingY)};padding-bottom:${spaceVar(paddingY)};` : "",
			margin !== undefined ? `margin:${spaceVar(margin)};` : "",
			radius !== undefined ? `border-radius:var(--radius-${radius});` : "",
			containerStyle(container),
			styleProp
		].join("")
	);
</script>

<svelte:element this={as} class="gg-box {className}" style={inlineStyle}>
	{@render children?.()}
</svelte:element>

<style>
	.gg-box {
		box-sizing: border-box;
	}
</style>
