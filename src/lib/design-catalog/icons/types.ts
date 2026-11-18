/**
 * types.ts — Tipos de la iconografía unificada de `@becall/design-system` (v1.13.0).
 *
 * Permite elegir por proyecto entre la familia predeterminada `"lucide"` (contorno
 * 24×24) y la familia `"clay"` (Claymorphism BeCall, generada desde los maestros
 * de `assets/icons/clay/` y tokenizada con `--icon-clay-*`).
 */

/** Familia de iconos del sistema. `"lucide"` es el valor predeterminado sin cambios. */
export type IconFamily = "lucide" | "clay";

/** Selección de familia en una instancia de `<Icon>` (`"auto"` hereda la del proyecto). */
export type IconFamilySelection = "auto" | IconFamily;

/** Tonos semánticos de un icono Claymorphism (mapeados a `--icon-clay-<tone>-*`). */
export type IconTone =
	| "inherit"
	| "neutral"
	| "primary"
	| "success"
	| "warning"
	| "danger"
	| "info"
	| "accent"
	| "on-primary";

/** Tratamiento formal dentro de la familia Claymorphism (§4). */
export type ClayIconStyle = "volumen-relleno" | "relieve-lineal";

/** Bloque del catálogo (§2): A (internos del DS), B (genérico de app), C (audio y comunicación). */
export type IconCatalogBlock = "A" | "B" | "C";

/** Comportamiento cuando un icono pedido en modo `"clay"` no tiene variante Clay ni está en `exceptions`. */
export type MissingIconPolicy = "warn" | "throw" | "silent";

/** Configuración de iconografía a nivel de proyecto o subárbol. */
export interface IconConfig {
	/** Familia activa del proyecto (`"lucide"` por defecto). */
	family?: IconFamily;
	/** Lista de nombres de icono que se fuerzan siempre a `"lucide"` sin aviso de ausencia. */
	exceptions?: readonly string[];
	/** Política ante ausencias no declaradas en modo `"clay"` (`"warn"` por defecto). */
	onMissing?: MissingIconPolicy;
}

/** Especificación opcional del SVG histórico en modo `"lucide"` para componentes internos del DS. */
export interface LegacySvgSpec {
	viewBox: string;
	body: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: string | number;
	strokeLinecap?: "butt" | "round" | "square" | "inherit";
	strokeLinejoin?: "miter" | "round" | "bevel" | "inherit";
}

/** Definición completa de un motivo del catálogo unificado. */
export interface IconDefinition {
	readonly id: string;
	readonly label: string;
	readonly block: IconCatalogBlock;
	readonly style: ClayIconStyle;
	readonly defaultTone: Exclude<IconTone, "inherit">;
	readonly internalGlyph?: boolean;
	readonly animated?: boolean;
	/** Interior SVG en modo `"lucide"` (viewBox 0 0 24 24). */
	readonly lucideSvg: string;
	/** Interior SVG Claymorphism completo (>= 24 px, incluido `<defs>` con prefijo `__ID__`). */
	readonly clayFullSvg: string;
	/** Interior SVG Claymorphism simplificado (< 24 px, sin `<defs>` ni `<filter>`). */
	readonly claySimplifiedSvg: string;
}
