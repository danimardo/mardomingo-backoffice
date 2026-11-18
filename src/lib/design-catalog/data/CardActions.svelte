<script lang="ts">
	/**
	 * CardActions — fila de botones, normalmente dentro de `CardFooter`.
	 * Es literalmente `HStack` con los valores por defecto que pide una
	 * barra de acciones (`justify="end"`, `gap=2`) — la misma pieza con
	 * una prop fija, mismo criterio que ya se aplicó a `VStack`/`HStack`
	 * en Fase 1 (ver `docs/ROADMAP.md`), no una reimplementación aparte.
	 */
	import type { Snippet } from "svelte";
	import type { JustifyValue, SpaceToken } from "../primitives/types.js";
	import HStack from "../primitives/HStack.svelte";

	interface Props {
		justify?: JustifyValue;
		gap?: SpaceToken;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { justify = "end", gap = 2, class: className = "", style: styleProp = "", children }: Props = $props();
</script>

<HStack {justify} {gap} align="center" wrap class="gg-card-actions {className}" style={styleProp}>
	{@render children?.()}
</HStack>
