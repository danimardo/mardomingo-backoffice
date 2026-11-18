/**
 * laneLayout.ts — empaquetado de ausencias en "carriles" (lanes) dentro
 * de UNA semana, para que una ausencia de varios días se vea como UNA
 * barra continua que cruza las celdas de esa semana (mismo criterio
 * visual que la vista de mes de Google Calendar/Outlook para eventos de
 * varios días) en vez de repetir la etiqueta del empleado en cada celda
 * suelta sin relación visible entre ellas.
 *
 * Lógica PURA (sin Svelte, sin DOM) a propósito — es el único cálculo de
 * Fase 3 con reglas no triviales (qué ausencia cae en qué carril, cuándo
 * se desborda a "+N"), así que vive aparte para poder razonar sobre ella
 * (y, si hiciera falta, probarla) sin montar un componente.
 *
 * Algoritmo por semana (no por mes entero): cada semana se empaqueta por
 * separado, con como mucho `maxLanes` carriles visibles simultáneos —
 * una ausencia que no cabe en ningún carril libre ESE día no se dibuja,
 * y cuenta en `overflowByDay` de cada día que ocupa (la UI la resume como
 * "+N", Historias.md no pide ver todas las ausencias a la vez a costa de
 * una fila de altura variable sin límite). Greedy, orden por inicio
 * (recortado a la semana) y luego por duración descendente — mismo
 * criterio que la mayoría de calendarios de referencia: los eventos
 * largos "reservan sitio" antes que los cortos, para que no acaben
 * fragmentados en varios carriles distintos semana a semana.
 */
import type { AbsenceEntry } from "./types.js";
import { fromISODate, isBeforeDay, isAfterDay } from "../forms/dateUtils.js";

export interface LanePlacement {
	entry: AbsenceEntry;
	/** Columna de inicio dentro de la semana, 0 (lunes) a 6 (domingo) — recortada si la ausencia empezó antes de esta semana. */
	startCol: number;
	/** Columna de fin dentro de la semana, 0-6 — recortada si la ausencia sigue después de esta semana. */
	endCol: number;
	/** Si la ausencia empieza de verdad en esta semana (no viene recortada por la izquierda) — decide si la barra lleva esquina redondeada a la izquierda. */
	isTrueStart: boolean;
	/** Igual que `isTrueStart`, para el extremo derecho. */
	isTrueEnd: boolean;
}

export interface WeekLayout {
	/** `lanes[carril][columna 0-6]` — `null` si ese carril no tiene ausencia esa columna. */
	lanes: (LanePlacement | null)[][];
	/** Ausencias que no cupieron en ningún carril, por columna (0-6) — la cuenta para el "+N" de ese día. */
	overflowByDay: number[];
}

function dayIndexInWeek(d: Date, weekStart: Date): number {
	return Math.round((d.getTime() - weekStart.getTime()) / 86400000);
}

export function computeWeekLayout(weekDates: Date[], entries: AbsenceEntry[], maxLanes: number): WeekLayout {
	const weekStart = weekDates[0];
	const weekEnd = weekDates[weekDates.length - 1];
	if (!weekStart || !weekEnd) return { lanes: [], overflowByDay: new Array(7).fill(0) };

	const resolved = entries
		.map((entry) => {
			const start = fromISODate(entry.start);
			const end = fromISODate(entry.end);
			if (!start || !end) return null;
			// Ausencia FUERA de esta semana del todo — ni se calcula.
			if (isAfterDay(start, weekEnd) || isBeforeDay(end, weekStart)) return null;
			const clippedStart = isBeforeDay(start, weekStart) ? weekStart : start;
			const clippedEnd = isAfterDay(end, weekEnd) ? weekEnd : end;
			return {
				entry,
				startCol: dayIndexInWeek(clippedStart, weekStart),
				endCol: dayIndexInWeek(clippedEnd, weekStart),
				isTrueStart: !isBeforeDay(start, weekStart),
				isTrueEnd: !isAfterDay(end, weekEnd)
			};
		})
		.filter((x): x is LanePlacement => x != null)
		// Inicio recortado ascendente; a igualdad, duración descendente (los
		// largos "reservan sitio" primero).
		.sort((a, b) => a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol));

	const lanes: (LanePlacement | null)[][] = [];
	const overflowByDay = new Array(7).fill(0);

	for (const placement of resolved) {
		let placed = false;
		for (let l = 0; l < maxLanes; l++) {
			const lane = lanes[l] ?? (lanes[l] = new Array(7).fill(null));
			let free = true;
			for (let c = placement.startCol; c <= placement.endCol; c++) {
				if (lane[c] != null) {
					free = false;
					break;
				}
			}
			if (free) {
				for (let c = placement.startCol; c <= placement.endCol; c++) lane[c] = placement;
				placed = true;
				break;
			}
		}
		if (!placed) {
			for (let c = placement.startCol; c <= placement.endCol; c++) overflowByDay[c]++;
		}
	}

	return { lanes, overflowByDay };
}
