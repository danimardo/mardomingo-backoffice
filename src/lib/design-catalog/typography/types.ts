/**
 * Nombres de paso de la escala tipográfica (§7.2) — cada uno tiene su
 * trío --text-{step}-size/-leading/-weight en tokens.css. Un solo tipo
 * compartido entre Text y Heading para que no puedan desincronizarse.
 */
export type TextStep =
	| "display-1"
	| "display-2"
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "h5"
	| "h6"
	| "subtitle"
	| "body-lg"
	| "body"
	| "body-sm"
	| "caption"
	| "overline"
	| "label"
	| "code";

/**
 * Color semántico del texto — alias directo de los tokens `--text-*` /
 * `--status-*` de tokens.css, nunca un hex suelto. "inherit" deja que el
 * color lo decida el contenedor (p. ej. dentro de un botón que ya fija
 * `color`).
 *
 * Corrección post-ampliación 3 (continuación 3): "danger"/"info" usan
 * `--text-danger`/`--text-info`, NO `--status-danger`/`--status-info`
 * directamente. `Text`/`Heading` son piezas GENÉRICAS (Fase 1/2) sin
 * restricción de dónde se colocan — a diferencia de las correcciones
 * anteriores (3-4 piezas concretas cada una), cualquier consumidor puede
 * escribir `<Text tone="danger">`/`tone="info"` dentro de una `Card`
 * (`--surface-raised`). `--status-danger` ahí cae a 4.10:1 y
 * `--status-info` a 3.59:1 (peor aún) — ambos por debajo del 4.5:1 de
 * WCAG AA para texto normal; ver docs/TOKENS.md. "success"/"warning" SÍ
 * se quedan en `--status-success`/`--status-warning`: ya pasan AA contra
 * las tres superficies (5.10:1/5.46:1 contra `--surface-raised` en
 * oscuro), sin necesitar un token nuevo.
 */
export type TextTone =
	| "primary"
	| "secondary"
	| "muted"
	| "disabled"
	| "success"
	| "warning"
	| "danger"
	| "info"
	| "inherit";

export const TONE_VAR: Record<Exclude<TextTone, "inherit">, string> = {
	primary: "var(--text-primary)",
	secondary: "var(--text-secondary)",
	muted: "var(--text-muted)",
	disabled: "var(--text-disabled)",
	success: "var(--status-success)",
	warning: "var(--status-warning)",
	danger: "var(--text-danger)",
	info: "var(--text-info)"
};
