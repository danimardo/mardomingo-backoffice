/**
 * types.ts — modelo de datos compartido por `AbsenceCalendarMonth`/
 * `Year`/`Employee`/`Legend` (Fase 3 de la ronda de ampliación UX
 * post-v0.14.0, el núcleo nuevo que consume el vocabulario de Fase 2 —
 * ver `tokens/absence.ts` y `tokens.css`, sección "Vocabulario de
 * ausencias").
 */
import type { AbsenceType } from "../tokens/index.js";
import type { AbsenceIcon } from "./identity.js";

export type { AbsenceType };

/**
 * Aviso de cobertura de un día (v1.7.0) para `AbsenceCalendarMonth`
 * (`coverageNotice`). El paquete no calcula cobertura: el consumidor
 * compone los textos (ya en castellano) y decide el enlace según quién
 * mira. El triángulo del día muestra `summary` como tooltip y, al
 * pulsarlo, abre un diálogo con `detail` y el enlace.
 */
export interface CoverageNotice {
	/** Una línea corta: «Soporte: faltan 2 de 3 personas» (varios roles separados por «; »). */
	summary: string;
	/** Párrafos de la explicación: qué pasa, por qué y cómo arreglarlo. */
	detail: string[];
	/** Destino del enlace del diálogo (p. ej. configurar mínimos). Sin él, no hay enlace. */
	href?: string;
	/** Texto del enlace — obligatorio en la práctica si se pasa `href`. */
	linkLabel?: string;
}

/**
 * Una ausencia de un empleado, ya resuelta a un rango de fechas concreto
 * — el consumidor construye este array a partir de lo que tenga en su
 * backend (periodos de vacaciones, días sueltos, otras ausencias de
 * Historias.md §2), este paquete no distingue de dónde vino cada una más
 * allá de su `type`.
 */
export interface AbsenceEntry {
	/** Identificador único de la ausencia (no del empleado) — clave de `{#each}` y de `onEntryClick`. */
	id: string;
	employeeId: string;
	employeeName: string;
	/**
	 * Posición de este empleado en la paleta categórica
	 * (`employeeColorVar()` de `tokens/absence.ts`) — la ASIGNACIÓN
	 * persistente de qué índice le toca a qué empleado es estado de la
	 * app consumidora (Historias.md §4.1: el color se guarda en la ficha
	 * del empleado), no de este paquete.
	 */
	employeeColorIndex: number;
	type: AbsenceType;
	/**
	 * Subcategoría LIBRE dentro de `type: "other"` (p. ej. "Formación",
	 * "Permiso", "Desplazamiento") — feedback real del desarrollador
	 * frontend consumidor tras v0.15.0: varias subcategorías de "otra
	 * ausencia" compartían un único estilo discontinuo sin forma de
	 * distinguirse entre sí. Campo NO disruptivo (opcional, `undefined`
	 * por defecto, no cambia `AbsenceType` ni el algoritmo sólido/
	 * discontinuo ya construido) — es una capa puramente TEXTUAL/
	 * accesible por ahora: aparece en el `aria-label`/`title` de la barra
	 * de `AbsenceCalendarMonth` y en la columna "Tipo" de la lista de
	 * `AbsenceCalendarEmployee`. La distinción VISUAL por icono o patrón
	 * (lo que el desarrollador pidió literalmente) sigue pendiente del
	 * set de iconos del diseñador externo, igual que el resto de iconos
	 * del catálogo de ausencias — este campo es lo mínimo accesible que
	 * no bloquea en esa respuesta.
	 */
	subtype?: string;
	/**
	 * Icono del tipo o subtipo de ausencia (v1.1.0) — cualquier componente de
	 * `@lucide/svelte` (p. ej. `GraduationCap` para "Formación", `Plane` para
	 * "Desplazamiento"). Es la distinción VISUAL que completa a `subtype`:
	 * se pinta al inicio de la barra de `AbsenceCalendarMonth`, siempre
	 * acompañado de texto accesible. La correspondencia subtipo → icono es
	 * decisión del consumidor (ver identity.ts).
	 */
	icon?: AbsenceIcon;
	/**
	 * Iniciales del empleado (v1.1.0). Si se omiten se calculan de
	 * `employeeName` con `employeeInitials()`. Son el segundo canal de
	 * identidad: la paleta tiene 12 colores (v1.7.0) y se repite con más personas.
	 */
	employeeInitials?: string;
	/** Fecha de inicio, "aaaa-mm-dd" (ISO) — igual de inicio=fin para una ausencia de un solo día. */
	start: string;
	/** Fecha de fin, "aaaa-mm-dd" (ISO), inclusive. */
	end: string;
}
