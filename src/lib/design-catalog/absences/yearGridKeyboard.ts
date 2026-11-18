/**
 * yearGridKeyboard.ts — roving tabindex + navegación por teclado
 * compartida entre `AbsenceCalendarYear` y `AbsenceCalendarEmployee`
 * (v0.16.0, feedback real del desarrollador frontend consumidor: "la
 * vista anual necesita acceso por teclado — hoy cada día visible es su
 * propio parón de Tab, hasta ~365 en un año completo"). Misma matemática
 * que el `onKeydown` de `Calendar.svelte` (flechas ±1 día/±1 semana,
 * Home/End a los extremos de la semana enfocada, RePág/AvPág ±1 mes) pero
 * generalizada a una cuadrícula de DOCE meses independientes en vez de
 * uno: cada componente consumidor delega UN único `onkeydown` en su
 * CONTENEDOR exterior (no en cada `<tbody>`), porque los doce `<table>`
 * son doce grids separados, no una única cuadrícula continua — un solo
 * `focused: Date` (fecha, no posición de tabla) basta para los dos, ya
 * que una fecha es única en todo el año.
 *
 * Sin RePág/AvPág + Mayús (año): ninguno de los dos componentes posee
 * navegación de AÑO propia (`year` es una prop de solo lectura, sin
 * `onYearChange`), así que saltar "un año" solo podría aterrizar fuera de
 * lo que el componente renderiza — en vez de inventar ese contrato
 * todavía sin que lo pida nadie, se deja sin implementar (como RePág/
 * AvPág normal, el salto se recorta al 1 de enero/31 de diciembre del
 * `year` mostrado, así que el límite ya es alcanzable de todas formas).
 */
import { addDays, isBeforeDay, isAfterDay } from "../forms/dateUtils.js";

/** Recorta `d` a `[1 de enero, 31 de diciembre]` de `year` — ninguno de los dos componentes consumidores navega fuera de su propio `year`. */
export function clampToYear(d: Date, year: number): Date {
	const first = new Date(year, 0, 1);
	const last = new Date(year, 11, 31);
	if (isBeforeDay(d, first)) return first;
	if (isAfterDay(d, last)) return last;
	return d;
}

/** `addMonths` que conserva el día del mes cuando existe en el mes de destino, recortando al último día de ese mes cuando no (p. ej. 31 ene + 1 mes -> 28/29 feb, nunca un desbordamiento a marzo). */
function addMonthsClampedDay(d: Date, n: number): Date {
	const targetMonthIndex = d.getMonth() + n;
	const targetYear = d.getFullYear() + Math.floor(targetMonthIndex / 12);
	const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
	const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
	return new Date(targetYear, targetMonth, Math.min(d.getDate(), daysInTargetMonth));
}

/**
 * Siguiente día enfocado dado `current` y la tecla pulsada, ya recortado
 * a `[1 ene, 31 dic]` de `year` — `null` si la tecla no es una de
 * navegación reconocida (el llamador no hace nada, deja que el evento
 * siga su curso normal).
 */
export function nextFocusedDay(current: Date, year: number, key: string): Date | null {
	let next: Date;
	if (key === "ArrowRight") next = addDays(current, 1);
	else if (key === "ArrowLeft") next = addDays(current, -1);
	else if (key === "ArrowDown") next = addDays(current, 7);
	else if (key === "ArrowUp") next = addDays(current, -7);
	else if (key === "Home") next = addDays(current, -((current.getDay() + 6) % 7));
	else if (key === "End") next = addDays(current, 6 - ((current.getDay() + 6) % 7));
	else if (key === "PageUp") next = addMonthsClampedDay(current, -1);
	else if (key === "PageDown") next = addMonthsClampedDay(current, 1);
	else return null;
	return clampToYear(next, year);
}
