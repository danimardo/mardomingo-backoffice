
<script lang="ts">
	/**
	 * GlassPanel (§6, Fase 8) — `GlassSurface` con los valores por defecto
	 * de un panel FLOTANTE que va a contener contenido directamente
	 * (popover/sheet/panel lateral, no una tarjeta embebida en el flujo
	 * normal): más padding, radio más grande, e `intensity="elevated"` —
	 * un panel que flota SOBRE otro contenido pide un cristal más
	 * marcado que una superficie de cristal inline, mismo criterio de
	 * "quién lo usa decide la intensidad por defecto" que ya separaba
	 * `Card` (`elevation="raised"`) de `Surface` base en Fase 4.
	 *
	 * Sin `CardHeader`/`CardBody`/`CardFooter` propios — son las mismas
	 * piezas de Fase 4, que se pueden anidar dentro si hace falta
	 * estructura (`<GlassPanel><CardHeader>...`), igual que `Card` no
	 * reimplementó su propio sistema de header/body.
	 */
	import type { Snippet } from "svelte";
	import GlassSurface from "./GlassSurface.svelte";
	import type { ElevationToken, GlassIntensity, RadiusToken, SpaceToken } from "../primitives/types.js";

	interface Props {
		as?: keyof HTMLElementTagNameMap;
		intensity?: GlassIntensity;
		elevation?: ElevationToken;
		radius?: RadiusToken;
		padding?: SpaceToken;
		border?: boolean;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		as = "div",
		intensity = "elevated",
		elevation = "glass",
		radius = "xl",
		padding = 4,
		border = true,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();
</script>

<GlassSurface {as} {intensity} {elevation} {radius} {padding} {border} class="gg-glass-panel {className}" style={styleProp}>
	{@render children?.()}
</GlassSurface>
