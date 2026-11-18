/**
 * Tipos y decisión de contraste compartidos por Fase 5 (§23-26, §69 Fase
 * 5): `Alert`, `Toast` y (por icono de estado) `EmptyState` comparten el
 * mismo vocabulario de tono que `DataCardStatus` (Fase 4) — se redefine
 * aquí en vez de importarlo de `data/` para que `feedback/` no dependa de
 * `data/` solo por un tipo (cada módulo de fase es autocontenido, mismo
 * criterio que ya separaba `navigation/types` de `forms/types`).
 */

export type FeedbackTone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * Decisión de contraste compartida por Alert Y Toast (nueva en Fase 5 — ningún
 * componente anterior pintaba un FONDO teñido de color de estado, solo
 * texto/iconos sobre superficies neutras). Verificado en navegador real
 * (Playwright, `color-mix()` computado, no calculado a mano) antes de
 * aceptarse — ver `docs/TOKENS.md` para el script y los números
 * completos:
 *
 * - El TINTE de fondo (`color-mix(in srgb, var(--status-X) 12%,
 *   var(--surface))`) es sutil a propósito: con `--status-X` como color
 *   de TEXTO encima, el margen de contraste es muy estrecho en oscuro
 *   (`--status-info` parte de 4.71:1 contra `--surface` liso — apenas
 *   0.21 por encima de AA — así que CUALQUIER tinte que use el mismo
 *   color como texto lo empuja por debajo de 4.5:1 a partir de ~3-4%).
 * - Por eso el texto de Alert/Toast NUNCA es el color de estado: título
 *   en `--text-primary`, cuerpo en `--text-secondary` — con el tinte al
 *   12% no bajan nunca de 5.63:1 en ningún tono/tema (holgura enorme
 *   sobre AA 4.5:1, porque estos alias ya parten de contrastes muy altos
 *   contra `--surface` — ver la tabla de Fase 1 en TOKENS.md).
 * - El color de estado vive en el ICONO (mismo patrón "punto/icono no
 *   textual" de `DataCardStatus`/Fase 4 — WCAG 1.4.11, umbral ≥3:1, no
 *   4.5:1) y en una franja lateral SÓLIDA (no semitransparente — un
 *   borde con alfa a un tono que sí se leyera bien no aguanta 3:1 ni
 *   contra el tinte ni contra el fondo exterior, medido: máx. ~2.4:1 al
 *   40% de opacidad). Sólido, el mismo `--status-X` ya verificado como
 *   texto contra `--surface` (Fase 1) también vale aquí: mínimo medido
 *   3.91:1 contra el propio tinte (info oscuro), con margen.
 * - El marco general de la caja (que se perciba como una caja, no el
 *   significado del tono) lo da un borde NEUTRO (`--border-subtle`),
 *   igual que `Surface`/`Card` — no depende del tinte, que es
 *   deliberadamente sutil.
 */
export const FEEDBACK_TINT_PERCENT = 12;
