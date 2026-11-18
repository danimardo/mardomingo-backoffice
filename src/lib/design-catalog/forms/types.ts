/**
 * Tipos y helpers compartidos por los controles de formulario (Fase 2,
 * §12-15): Input, TextArea, Checkbox, Radio, Switch, Select. Mismo
 * criterio que buttons/types.ts — un solo sitio para que "tamaño md" o
 * "estado error" se vean y midan igual en los seis controles.
 *
 * Los "estados estándar obligatorios" (§64) que aplican a un control de
 * formulario son: default, hover, focus, active, disabled, error,
 * success, warning, readonly. hover/focus/active/disabled/readonly se
 * resuelven con pseudo-clases y atributos NATIVOS (:hover, :focus-visible,
 * :disabled, [readonly]) — nunca con una prop que los duplique. Solo
 * error/success/warning necesitan una prop (`state`), porque no hay
 * pseudo-clase nativa para "este campo tiene un error de validación".
 */

export type ControlSize = "sm" | "md" | "lg";
export type ControlState = "default" | "error" | "success" | "warning";

interface ControlSizeSpec {
	paddingX: string;
	paddingY: string;
	fontSize: string;
	lineHeight: string;
	radius: string;
	gap: string;
	/** Lado del cuadro de Checkbox/Radio y de la pista de Switch. */
	controlBoxSize: string;
}

const SIZES: Record<ControlSize, ControlSizeSpec> = {
	sm: {
		paddingX: "var(--space-3)",
		paddingY: "var(--space-1)",
		fontSize: "max(var(--text-body-sm-size), var(--control-font-min))",
		lineHeight: "var(--text-body-sm-leading)",
		radius: "var(--radius-md)",
		gap: "var(--space-2)",
		controlBoxSize: "var(--space-4)"
	},
	md: {
		paddingX: "var(--space-4)",
		paddingY: "var(--space-2)",
		fontSize: "max(var(--text-body-size), var(--control-font-min))",
		lineHeight: "var(--text-body-leading)",
		radius: "var(--radius-md)",
		gap: "var(--space-2)",
		controlBoxSize: "var(--space-5)"
	},
	lg: {
		paddingX: "var(--space-5)",
		paddingY: "var(--space-3)",
		fontSize: "max(var(--text-body-lg-size), var(--control-font-min))",
		lineHeight: "var(--text-body-lg-leading)",
		radius: "var(--radius-md)",
		gap: "var(--space-3)",
		controlBoxSize: "var(--space-6)"
	}
};

export function controlSizeSpec(size: ControlSize): ControlSizeSpec {
	return SIZES[size];
}

/**
 * Color de borde por estado. error/success/warning reutilizan
 * `--status-*`, el MISMO token ya verificado AA como color de TEXTO
 * (generate-tokens.mjs) — aquí se usa como borde de 1-2px, no como
 * texto ni como relleno sólido, así que aplica la regla de contraste NO
 * textual de WCAG 1.4.11 (mínimo 3:1 frente al fondo adyacente), que un
 * par ya verificado a ≥4.5:1 cumple sin necesidad de una comprobación
 * aparte.
 */
export function stateBorderVar(state: ControlState): string {
	switch (state) {
		case "error":
			return "var(--status-danger)";
		case "success":
			return "var(--status-success)";
		case "warning":
			return "var(--status-warning)";
		default:
			// BeCall §7.1/§15: el contorno de un control usa el borde
			// "strong" (≥3:1 contra su fondo), no el decorativo --border.
			return "var(--border-strong)";
	}
}

/** Mismo color que el borde, para el anillo de foco cuando hay estado. */
export function stateRingVar(state: ControlState): string {
	return state === "default" ? "var(--focus)" : stateBorderVar(state);
}
