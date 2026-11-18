<script lang="ts">
	/**
	 * Flex — flexbox genérico (§8.2). Stack/VStack/HStack (más abajo) son
	 * casos particulares de Flex con `direction` fija, para cubrir el 90%
	 * de layouts sin tener que pensar en flex-direction cada vez.
	 */
	import type { Snippet } from "svelte";
	import type { AlignValue, JustifyValue, RadiusToken, SpaceToken } from "./types.js";
	import { alignToCss, justifyToCss, spaceVar, containerStyle } from "./types.js";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
		direction?: "row" | "column" | "row-reverse" | "column-reverse";
		wrap?: boolean;
		align?: AlignValue;
		justify?: JustifyValue;
		gap?: SpaceToken;
		padding?: SpaceToken;
		radius?: RadiusToken;
		/** Cada hijo directo crece para repartirse el espacio disponible. */
		grow?: boolean;
		container?: boolean | string;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		as = "div",
		direction = "row",
		wrap = false,
		align,
		justify,
		gap,
		padding,
		radius,
		grow = false,
		container,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let inlineStyle = $derived(
		[
			"display:flex;",
			`flex-direction:${direction};`,
			wrap ? "flex-wrap:wrap;" : "",
			align ? `align-items:${alignToCss(align)};` : "",
			justify ? `justify-content:${justifyToCss(justify)};` : "",
			gap !== undefined ? `gap:${spaceVar(gap)};` : "",
			padding !== undefined ? `padding:${spaceVar(padding)};` : "",
			radius !== undefined ? `border-radius:var(--radius-${radius});` : "",
			containerStyle(container),
			styleProp
		].join("")
	);
</script>

<svelte:element this={as} class="gg-flex {grow ? 'gg-flex--grow-children' : ''} {className}" style={inlineStyle}>
	{@render children?.()}
</svelte:element>

<style>
	.gg-flex {
		box-sizing: border-box;
		min-width: 0;
	}

	.gg-flex--grow-children > :global(*) {
		flex: 1 1 0%;
		min-width: 0;
	}
</style>
