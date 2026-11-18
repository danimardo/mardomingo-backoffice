/**
 * Tipos compartidos por todos los primitivos de layout (§8). Un solo sitio
 * para las claves de espaciado/radio/elevación que Box, Stack, Flex, Grid
 * y Surface aceptan como props, para que las cinco piezas hablen el mismo
 * vocabulario y ninguna acepte un valor que no exista en tokens.css.
 */

/** Claves de --space-N en tokens.css — igual que la escala de Tailwind. */
export type SpaceToken = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64;

/** Claves de --radius-* en tokens.css. */
export type RadiusToken = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

/** Claves de --shadow-* en tokens.css — también el nombre de nivel de Surface. */
export type ElevationToken = "flat" | "raised" | "floating" | "overlay" | "modal" | "glass";

/** Claves de --surface-* semánticas en tokens.css. */
export type SurfaceToken = "base" | "raised" | "sunken" | "overlay" | "glass";

/** Intensidad de cristal (§62) — subtle/standard/elevated/immersive. */
export type GlassIntensity = "subtle" | "standard" | "elevated" | "immersive";
/** v1.9.0 — material de `Surface`: opaco, cristal con desenfoque (lo que flota) o cristal sin desenfoque (lo que va en el flujo). */
export type SurfaceMaterial = "solid" | "glass" | "glass-inline";

export type AlignValue = "start" | "center" | "end" | "stretch" | "baseline";
export type JustifyValue = "start" | "center" | "end" | "between" | "around" | "evenly";

const ALIGN_MAP: Record<AlignValue, string> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	stretch: "stretch",
	baseline: "baseline"
};

const JUSTIFY_MAP: Record<JustifyValue, string> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	between: "space-between",
	around: "space-around",
	evenly: "space-evenly"
};

export function alignToCss(v: AlignValue | undefined): string | undefined {
	return v ? ALIGN_MAP[v] : undefined;
}

export function justifyToCss(v: JustifyValue | undefined): string | undefined {
	return v ? JUSTIFY_MAP[v] : undefined;
}

/**
 * Traduce un SpaceToken (o undefined) a `var(--space-N)`. Centralizado
 * aquí para que "0" no dé un `var(--space-0)` vacío por accidente — 0
 * siempre puede resolverse directo a "0px", igual que hace tokens.css.
 */
export function spaceVar(token: SpaceToken | undefined): string | undefined {
	if (token === undefined) return undefined;
	return `var(--space-${token})`;
}

/** Construye el atajo container-type/container-name (§4.3) cuando `container` está activo. */
export function containerStyle(container: boolean | string | undefined): string {
	if (!container) return "";
	const name = typeof container === "string" ? container : "";
	return `container-type:inline-size;${name ? `container-name:${name};` : ""}`;
}
