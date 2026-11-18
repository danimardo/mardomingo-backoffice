<script lang="ts">
	/**
	 * Stack — Flex en columna (§8.2), el layout más común de todos: una
	 * lista de elementos apilados con espacio uniforme entre ellos. Alias
	 * explícito de VStack (mismo componente, dos nombres) porque ambos
	 * términos aparecen indistintamente en la especificación.
	 */
	import type { Snippet } from "svelte";
	import type { AlignValue, JustifyValue, RadiusToken, SpaceToken } from "./types.js";
	import Flex from "./Flex.svelte";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
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

<Flex {...props} direction="column" />
