// GENERADO por scripts/generate-tokens.mjs — no editar a mano.
// Nombres de las paletas e intensidades del fondo ambiental. Los colores
// están en tokens.css (región @generated:ambient).

export const AMBIENT_PALETTES = [
	{
		"id": "corporativa",
		"label": "Corporativa",
		"description": "Azul y naranja de marca: el degradado corporativo del documento (§18.2)."
	},
	{
		"id": "oceano",
		"label": "Océano",
		"description": "Solo azules y turquesas: la versión más fría y tranquila."
	},
	{
		"id": "atardecer",
		"label": "Atardecer",
		"description": "Dominan el naranja y el melocotón, con un toque de azul."
	},
	{
		"id": "grafito",
		"label": "Grafito",
		"description": "Grises fríos casi neutros: para pantallas densas o un aspecto sobrio."
	}
] as const;

export type AmbientPalette = (typeof AMBIENT_PALETTES)[number]["id"];

export const AMBIENT_INTENSITIES = [
	{
		"id": "muy-sutil",
		"label": "Muy sutil"
	},
	{
		"id": "sutil",
		"label": "Sutil"
	},
	{
		"id": "suave",
		"label": "Suave"
	},
	{
		"id": "original",
		"label": "Original"
	}
] as const;

export type AmbientIntensity = (typeof AMBIENT_INTENSITIES)[number]["id"];

export const DEFAULT_AMBIENT_PALETTE: AmbientPalette = "corporativa";
export const DEFAULT_AMBIENT_INTENSITY: AmbientIntensity = "sutil";
