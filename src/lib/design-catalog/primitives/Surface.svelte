<script lang="ts">
	/**
	 * Surface — un Box con identidad visual: fondo semántico + elevación +
	 * (opcionalmente) el material "Liquid Glass" (§6, §62). Es la pieza de
	 * la que casi todo lo demás en fases posteriores hereda (Card, Dialog,
	 * Sidebar, Toolbar...) — aquí solo se sienta la base reutilizable.
	 *
	 * `elevation` fija --shadow-* Y decide el `surface` por defecto (flat
	 * -> base, raised -> raised, floating/overlay/modal -> overlay, glass
	 * -> glass) para que "una tarjeta flotante" no requiera dos props
	 * coordinadas a mano; `surface` puede aún así forzarse aparte.
	 *
	 * CORRECCIÓN (Fase 8, descubierta al construir `GlassSurface`/
	 * `GlassPanel`): `--glass-border`/`--glass-highlight` (§62) existen en
	 * tokens.css desde Fase 1 pero NUNCA se habían leído desde ningún
	 * componente — el modo `glass` solo aplicaba blur+saturación+tinte
	 * (`--glass-opacity`/`--glass-blur`/`--glass-saturation`/`--glass-tint`),
	 * dejando el borde en el `--border` genérico y sin el filo de luz
	 * superior que el propio §6 pide ("reflejos suaves"). Corregido: en
	 * modo `glass`, el borde usa `--glass-border` (no `--border`/
	 * `--border-subtle`) y se añade un inset de 1px en `--glass-highlight`
	 * al `box-shadow` ya existente — `--shadow-${elevation}` se mantiene
	 * intacto (incluido el caso `elevation="glass"` -> `--shadow-glass`,
	 * que ya funcionaba), esto solo AÑADE la capa de brillo que faltaba.
	 * Cero riesgo para lo ya entregado: ningún componente de Fases 1-7
	 * pasa `glass={true}` (solo lo demuestra `GlassSection` de la guía de
	 * estilos), así que esta rama no se ejercitaba en producción todavía.
	 *
	 * v1.9.0 — material de cristal de appearance.css. `material` elige:
	 *   - "solid" (por defecto): como siempre;
	 *   - "glass" (o `glass={true}`, o `surface="glass"`): cristal CON
	 *     desenfoque (`.bc-glass`), para superficies que flotan sobre otro
	 *     contenido. El desenfoque va en un pseudo-elemento: el elemento ya
	 *     no recibe `backdrop-filter`, así que un `DatePicker` o un
	 *     `Toggletip` (`position: fixed`) de dentro siguen colocándose bien;
	 *   - "glass-inline": cristal SIN desenfoque (`.bc-glass-inline`), para
	 *     superficies en el flujo (lo usa `Card` por defecto): tinte
	 *     translúcido, reflejo y canto, sin contexto de apilamiento, de modo
	 *     que un desplegable de dentro no queda tapado por la tarjeta
	 *     siguiente.
	 * En los dos, el tinte es la superficie resuelta (`--surface-raised` en
	 * una tarjeta: con efectos reducidos o apagados vuelve a ser exactamente
	 * la tarjeta opaca de antes) y la sombra, la de `elevation`. Reflejo,
	 * canto, degradación y la regla «nunca cristal dentro de cristal» los
	 * resuelve appearance.css.
	 */
	import type { Snippet } from "svelte";
	import type { ElevationToken, GlassIntensity, RadiusToken, SpaceToken, SurfaceMaterial, SurfaceToken } from "./types.js";
	import { spaceVar, containerStyle } from "./types.js";

	const ELEVATION_TO_SURFACE: Record<ElevationToken, SurfaceToken> = {
		flat: "base",
		raised: "raised",
		floating: "overlay",
		overlay: "overlay",
		modal: "overlay",
		glass: "glass"
	};

	interface Props {
		as?: keyof HTMLElementTagNameMap | undefined;
		elevation?: ElevationToken | undefined;
		surface?: SurfaceToken | undefined;
		/** Aplica el filtro de cristal (backdrop-filter) además del fondo semántico. Equivale a `material="glass"`. */
		glass?: boolean | undefined;
		/** v1.9.0 — "solid" (por defecto), "glass" (con desenfoque, para lo que flota) o "glass-inline" (sin desenfoque, para lo que va en el flujo). */
		material?: SurfaceMaterial | undefined;
		glassIntensity?: GlassIntensity | undefined;
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
		elevation = "flat",
		surface,
		glass = false,
		material = "solid",
		glassIntensity = "standard",
		radius = "lg",
		padding,
		border = true,
		container,
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let resolvedSurface = $derived(surface ?? ELEVATION_TO_SURFACE[elevation]);
	let resolvedMaterial = $derived<SurfaceMaterial>(
		glass || resolvedSurface === "glass" ? "glass" : material
	);
	let isGlassSurface = $derived(resolvedMaterial !== "solid");
	let materialClass = $derived(
		resolvedMaterial === "glass"
			? `bc-glass bc-glass--${glassIntensity}`
			: resolvedMaterial === "glass-inline"
				? `bc-glass-inline bc-glass--${glassIntensity}`
				: ""
	);

	let inlineStyle = $derived(
		[
			isGlassSurface
				? // Tinte y sombra como variables: el material (appearance.css)
					// decide cuándo son translúcidos y añade reflejo y canto. Con
					// surface="glass" el tinte es --glass-tint; si no, la superficie
					// resuelta, para que sin efectos quede la superficie opaca de siempre.
					`--bc-glass-tint:var(--${resolvedSurface === "glass" ? "glass-tint" : resolvedSurface === "base" ? "surface" : `surface-${resolvedSurface}`});` +
					// --shadow-flat es `none`, que no admite ir en una lista con el
					// canto: se sustituye por una sombra nula equivalente.
					`--bc-glass-shadow:${elevation === "flat" ? "0 0 0 transparent" : `var(--shadow-${elevation})`};`
				: `background-color:var(--surface${resolvedSurface === "base" ? "" : `-${resolvedSurface}`});` +
					`box-shadow:var(--shadow-${elevation});`,
			`border-radius:var(--radius-${radius});`,
			border
				? isGlassSurface
					? `border:1px solid var(--glass-border);`
					: `border:1px solid var(--border${resolvedSurface === "base" ? "-subtle" : ""});`
				: "border:none;",
			padding !== undefined ? `padding:${spaceVar(padding)};` : "",
			containerStyle(container),
			styleProp
		].join("")
	);
</script>

<svelte:element this={as} class="gg-surface {materialClass} {className}" style={inlineStyle}>
	{@render children?.()}
</svelte:element>

<style>
	.gg-surface {
		box-sizing: border-box;
		transition:
			background-color var(--duration-normal) var(--easing-standard),
			box-shadow var(--duration-normal) var(--easing-standard),
			border-color var(--duration-normal) var(--easing-standard);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-surface {
			transition: none;
		}
	}
</style>
