<script lang="ts">
	/** HStack — Flex en fila (§8.2). Ver Stack.svelte para el porqué del alias. */
	import type { Snippet } from "svelte";
	import type { AlignValue, JustifyValue, RadiusToken, SpaceToken } from "./types.js";
	import Flex from "./Flex.svelte";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
		wrap?: boolean;
		align?: AlignValue;
		justify?: JustifyValue;
		gap?: SpaceToken;
		padding?: SpaceToken;
		radius?: RadiusToken;
		container?: boolean | string;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let props: Props = $props();
</script>

<Flex {...props} direction="row" />
