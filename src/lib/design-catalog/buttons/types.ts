/**
 * Estilos compartidos por Button e IconButton (§11). Centralizado aquí
 * para que ambos generen exactamente el mismo CSS por variante/tamaño —
 * un botón con icono y uno con texto deben verse como la misma familia.
 *
 * Elección deliberada de qué pares texto/fondo usar por variante: SOLO
 * "primary" usa un fondo sólido de marca, con el par
 * --surface-button-primary / --color-on-primary ya verificado AA en
 * generate-tokens.mjs (4.88:1 oscuro, 7.76:1 claro). "danger" NO lleva
 * fondo sólido de --status-danger porque ese tono nunca se comprobó como
 * FONDO de botón (solo como color de TEXTO sobre superficie, que es donde
 * sí se verificó) — así que va en variante "outline" (texto+borde en
 * --text-danger sobre la superficie normal), reutilizando un par ya
 * verificado en vez de inventar uno nuevo sin comprobar. Un botón "danger"
 * de relleno sólido queda pendiente de Fase 2+ con su propia verificación
 * de contraste.
 *
 * Corrección post-ampliación 3: el texto usa --text-danger, NO
 * --status-danger. Button/IconButton no saben sobre qué superficie se
 * colocan (se usan tanto sueltos sobre --surface como dentro de una Card
 * elevada, --surface-raised) — --status-danger (danger-300 en oscuro)
 * pasaba AA como texto contra --surface (5.38:1) pero NO contra
 * --surface-raised (4.10:1, por debajo de 4.5:1), hallado al auditar el
 * mismo fallo que ya se corrigió una vez en Fase 4 (DataCardStatus/
 * AdaptiveDataView). --text-danger (danger-200 en oscuro) pasa AA como
 * texto contra CUALQUIERA de las tres superficies — ver la nota en
 * tokens.css y docs/TOKENS.md. El borde y los fondos de hover/active
 * siguen el mismo token por consistencia visual (son decorativos, no
 * texto — el umbral de 3:1 que ya cumplían con --status-danger lo siguen
 * cumpliendo, y con más margen, al usar un paso más claro).
 */

/**
 * v1.9.0 — "accent": botón de ÉNFASIS en naranja corporativo, para la
 * acción destacada puntual de una pantalla (p. ej. «Nueva solicitud» en un
 * panel donde la acción principal azul ya existe). No sustituye a
 * "primary" ni comunica aviso. Texto siempre oscuro: el blanco sobre
 * #E99B35 da 2,28:1 (documento §8). Pares verificados por
 * generate-tokens.mjs: --color-on-accent sobre --surface-button-accent,
 * --accent-hover y --accent-active (≥4,5:1 en los dos temas) y el borde
 * --border-button-accent sobre la superficie (≥3:1), que delimita el
 * botón en claro, donde el naranja sobre blanco no llega a 3:1.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

interface SizeSpec {
	paddingX: string;
	paddingY: string;
	gap: string;
	fontSize: string;
	lineHeight: string;
	fontWeight: string;
	radius: string;
	iconOnlySize: string;
}

const SIZES: Record<ButtonSize, SizeSpec> = {
	sm: {
		paddingX: "var(--space-3)",
		paddingY: "var(--space-1)",
		gap: "var(--space-1)",
		fontSize: "var(--text-body-sm-size)",
		lineHeight: "var(--text-body-sm-leading)",
		fontWeight: "var(--text-label-weight)",
		radius: "var(--radius-md)",
		iconOnlySize: "var(--space-8)"
	},
	md: {
		paddingX: "var(--space-4)",
		paddingY: "var(--space-2)",
		gap: "var(--space-2)",
		fontSize: "var(--text-body-size)",
		lineHeight: "var(--text-body-leading)",
		fontWeight: "var(--text-label-weight)",
		radius: "var(--radius-md)",
		iconOnlySize: "var(--space-10)"
	},
	lg: {
		paddingX: "var(--space-6)",
		paddingY: "var(--space-3)",
		gap: "var(--space-2)",
		fontSize: "var(--text-body-lg-size)",
		lineHeight: "var(--text-body-lg-leading)",
		fontWeight: "var(--text-label-weight)",
		radius: "var(--radius-md)",
		iconOnlySize: "var(--space-12)"
	}
};

interface VariantSpec {
	background: string;
	color: string;
	border: string;
	hoverBackground: string;
	activeBackground: string;
}

const VARIANTS: Record<ButtonVariant, VariantSpec> = {
	primary: {
		background: "var(--surface-button-primary)",
		color: "var(--color-on-primary)",
		border: "1px solid transparent",
		// BeCall §7: hover/pulsación = color.action.primary.hover/active,
		// que en Graphite Glass son --interactive-hover/--interactive-active
		// (verificados ≥4.5:1 con --color-on-primary en ambos temas por
		// scripts/generate-tokens.mjs).
		hoverBackground: "var(--interactive-hover)",
		activeBackground: "var(--interactive-active)"
	},
	secondary: {
		background: "transparent",
		color: "var(--text-primary)",
		// BeCall §15: el botón secundario usa el borde "strong" (≥3:1),
		// necesario para reconocer el control — --border es decorativo.
		border: "1px solid var(--border-strong)",
		hoverBackground: "var(--surface-raised)",
		activeBackground: "var(--surface-sunken)"
	},
	ghost: {
		background: "transparent",
		color: "var(--text-primary)",
		border: "1px solid transparent",
		hoverBackground: "var(--surface-raised)",
		activeBackground: "var(--surface-sunken)"
	},
	accent: {
		background: "var(--surface-button-accent)",
		color: "var(--color-on-accent)",
		border: "1px solid var(--border-button-accent)",
		hoverBackground: "var(--accent-hover)",
		activeBackground: "var(--accent-active)"
	},
	danger: {
		background: "transparent",
		color: "var(--text-danger)",
		border: "1px solid color-mix(in srgb, var(--text-danger) 45%, transparent)",
		hoverBackground: "color-mix(in srgb, var(--text-danger) 12%, transparent)",
		activeBackground: "color-mix(in srgb, var(--text-danger) 20%, transparent)"
	}
};

export function sizeSpec(size: ButtonSize): SizeSpec {
	return SIZES[size];
}

export function variantSpec(variant: ButtonVariant): VariantSpec {
	return VARIANTS[variant];
}
