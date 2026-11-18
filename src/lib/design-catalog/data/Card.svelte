<script lang="ts">
	/**
	 * Card (§20) — un `Surface` con el nombre y los valores por defecto
	 * que espera una tarjeta (`elevation="raised"`, `radius="lg"`), sin
	 * padding propio: `CardHeader`/`CardBody`/`CardFooter` traen el suyo,
	 * para que se puedan usar sueltos o combinados sin padding duplicado
	 * ni hueco a medias.
	 *
	 * Alcance deliberado (ver docs/ROADMAP.md): esta es la Card BASE, sin
	 * estado clicable propio. Las 13 variantes derivadas del catálogo
	 * completo (§20 — `MetricCard`, `StatCard`, `ActionCard`,
	 * `SelectionCard`, `ProductCard`...) no están en la lista curada de
	 * Fase 4 y quedan fuera de esta entrega, igual que ya se dejaron
	 * fuera `Submenu`/`ContextMenu` en Fase 3.
	 */
	import type { Snippet } from "svelte";
	import Surface from "../primitives/Surface.svelte";
	import type { ElevationToken, GlassIntensity, RadiusToken } from "../primitives/types.js";

	interface Props {
		elevation?: ElevationToken;
		/** v1.9.0 — cristal sin desenfoque (por defecto). `false`: tarjeta opaca. */
		glass?: boolean;
		/** v1.9.0 — opacidad del cristal; `elevated` por defecto (la verificada para texto de tarjeta). */
		glassIntensity?: GlassIntensity;
		radius?: RadiusToken;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let {
		elevation = "raised",
		glass = true,
		glassIntensity = "elevated",
		radius = "lg",
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();
</script>

<Surface {elevation} material={glass ? "glass-inline" : "solid"} {glassIntensity} {radius} class="gg-card {className}" style={styleProp}>
	{@render children?.()}
</Surface>
