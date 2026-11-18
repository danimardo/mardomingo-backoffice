/**
 * dateUtils.ts — utilidades de fecha compartidas por `DatePicker`/
 * `DateRangePicker`/`Calendar` (candidato #4 de la ronda de ampliación
 * post-v0.13.0, ver docs/ROADMAP.md — confirmado por el usuario como
 * "fecha única + rango, es-ES, semana empezando en lunes, formato
 * dd/mm/aaaa"). Sin dependencias externas (ni date-fns ni dayjs) — el
 * cálculo de calendario es aritmética de `Date` nativa, nada que
 * justifique una dependencia nueva en un paquete que hasta ahora no
 * tenía ninguna de fechas.
 *
 * Deliberadamente NO usa `Intl.DateTimeFormat`/`toLocaleDateString` para
 * el formato dd/mm/aaaa (aunque podría) porque el FORMATO en sí
 * (dd/mm/aaaa) está fijado por el usuario como requisito explícito, no
 * "lo que decida el locale del navegador" — así que se construye a mano,
 * siempre igual, sin importar el locale del sistema donde corra la app.
 * `MONTH_NAMES_ES`/`WEEKDAY_LABELS_ES` sí son vocabulario es-ES fijo, por
 * el mismo motivo (la app entera documenta en español, no tendría
 * sentido que el calendario cambiara de idioma con el navegador).
 */

export const MONTH_NAMES_ES = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre"
];

/** Lunes→domingo (semana empezando en lunes, no en domingo). */
export const WEEKDAY_LABELS_ES = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_NAMES_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Índice lunes=0..domingo=6, a partir del `getDay()` nativo (domingo=0..sábado=6). */
function mondayIndex(d: Date): number {
	return (d.getDay() + 6) % 7;
}

/**
 * Matriz de 42 días (6 semanas completas, lunes→domingo) que cubre el
 * mes `month` (0-11) de `year`, con los días de los meses anterior/
 * siguiente que completan la cuadrícula — los días fuera del mes llevan
 * `outside: true` (se pintan atenuados, pero siguen siendo clicables: es
 * lo que la mayoría de calendarios hace, saltar de mes sin tener que
 * usar los botones de navegación). Siempre 6 semanas, nunca 5 — una
 * cuadrícula de altura constante es más predecible que una que cambia de
 * tamaño mes a mes (§13 ux.md, "estabilidad visual").
 */
export interface CalendarDay {
	date: Date;
	outside: boolean;
}

export function getMonthMatrix(year: number, month: number): CalendarDay[] {
	const first = new Date(year, month, 1);
	const start = addDays(first, -mondayIndex(first));
	const days: CalendarDay[] = [];
	for (let i = 0; i < 42; i++) {
		const date = addDays(start, i);
		days.push({ date, outside: date.getMonth() !== month });
	}
	return days;
}

export function formatDateES(d: Date | null): string {
	if (!d) return "";
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	return `${dd}/${mm}/${yyyy}`;
}

/** Analiza "dd/mm/aaaa" — `null` si el texto no es una fecha válida en ese formato (incluye fechas imposibles como 31/02). */
export function parseDateES(text: string): Date | null {
	const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;
	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);
	const d = new Date(year, month - 1, day);
	if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
	return d;
}

export function isBeforeDay(a: Date, b: Date): boolean {
	return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function isAfterDay(a: Date, b: Date): boolean {
	return startOfDay(a).getTime() > startOfDay(b).getTime();
}

export function clampDate(d: Date, min?: Date | null, max?: Date | null): Date {
	let result = d;
	if (min && isBeforeDay(result, min)) result = min;
	if (max && isAfterDay(result, max)) result = max;
	return result;
}

/**
 * `toISODate`/`fromISODate` — puente entre el `Date` interno de
 * `Calendar` y el `string` "aaaa-mm-dd" (ISO 8601, el formato de
 * TRANSPORTE que pide la constitución de un proyecto consumidor —
 * `Temporal.PlainDate` en su código, "aaaa-mm-dd" en el límite) que usa
 * ahora la API PÚBLICA de `DatePicker`/`DateRangePicker` (`value`,
 * `minDate`, `maxDate`). `Date` sigue siendo el tipo interno de cálculo
 * de calendario (aritmética de mes/semana) — nunca se expone fuera de
 * este fichero y de `Calendar.svelte`.
 *
 * Deliberadamente NO usa `toISOString()`/`new Date(string)`: ambos pasan
 * por UTC, y un `Date` de calendario aquí siempre se construye en hora
 * LOCAL medianoche (`new Date(year, month, day)`) — `toISOString()`
 * puede desplazar la fecha un día en husos horarios con UTC- (la
 * medianoche local cae en el día anterior en UTC), justo el tipo de bug
 * invisible en pruebas con huso horario 0 que esta función evita por
 * construcción, extrayendo year/month/day locales a mano, igual que
 * `formatDateES`.
 */
export function toISODate(d: Date): string {
	const yyyy = String(d.getFullYear()).padStart(4, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

/** Analiza "aaaa-mm-dd" — `null` si el texto no es una fecha válida en ese formato (incluye fechas imposibles como 2026-02-30), mismo criterio que `parseDateES`. */
export function fromISODate(s: string | null | undefined): Date | null {
	if (!s) return null;
	const match = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const d = new Date(year, month - 1, day);
	if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
	return d;
}
