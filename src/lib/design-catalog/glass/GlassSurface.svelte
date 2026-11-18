
<script lang="ts">
	/**
	 * GlassSurface (§6, §62, Fase 8) — `Surface` (Fase 1) con el material
	 * "Liquid Glass" siempre activado y coordinado por defecto: el propio
	 * comentario de `Surface` explica que `elevation` evita tener que
	 * coordinar dos props para "una tarjeta flotante" — pero antes de
	 * esta pieza, un `Surface` en modo `glass` SÍ necesitaba coordinar dos
	 * props a mano (`glass` + `elevation="glass"`) para obtener la sombra
	 * de cristal correcta, porque `glass={true}` no cambiaba el
	 * `elevation` por defecto ("flat"). `GlassSurface` cierra ese hueco:
	 * `elevation` por defecto YA es `"glass"` — sigue siendo overridable
	 * si hace falta un cristal con otra sombra (p. ej. `elevation="modal"`
	 * para un `GlassModal` compuesto a mano).
	 *
	 * No es una reimplementación — es `Surface` con `glass` fijo a
	 * `true` (no expuesto como prop: si no quieres cristal, usa `Surface`
	 * directamente) y mejores valores por defecto. `GlassCard`/
	 * `GlassToolbar`/`GlassNavigation`/`GlassModal`/`GlassPopover`/
	 * `GlassSheet`/`GlassHeader` (candidatos de §6, no en la lista curada
	 * de §69) son composiciones de `GlassSurface`/`GlassPanel` con piezas
	 * ya existentes (`CardHeader`/`CardBody` de Fase 4, la estructura de
	 * `Dialog` de Fase 5, `DesktopToolbar` de Fase 7...) — no piezas
	 * nuevas, ver `docs/ROADMAP.md`.
	 */
	import type { Snippet } from "svelte";
	import Surface from "../primitives/Surface.svelte";
	import type { ElevationToken, GlassIntensity, RadiusToken, SpaceToken } from "../primitives/types.js";

	interface Props {
		as?: keyof HTMLElementTagNameMap | undefined;
		intensity?: GlassIntensity | undefined;
		elevation?: ElevationToken | undefined;
		radius?: RadiusToken | undefined;
		padding?: SpaceToken | undefined;
		border?: boolean | undefined;
		container?: boolean | string | undefined;
		class?: string | undefined;
		style?: string | undefined;
		children?: Snippet | undefined;
	}

	let {
		as = "div",
		intensity = "standard",
		elevation = "glass",
		radius = "lg",
		padding,
		border = true,
		container,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();
</script>

<Surface {as} glass glassIntensity={intensity} {elevation} {radius} {padding} {border} {container} class="gg-glass-surface {className}" style={styleProp}>
	{@render children?.()}
</Surface>
