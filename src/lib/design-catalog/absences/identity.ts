/**
 * identity.ts — segundo canal de identidad de empleado y tipo de icono de
 * ausencia (v1.1.0, a petición del panel de vacaciones).
 *
 * La paleta categórica tiene 12 colores (`--employee-1…12`, v1.7.0): con más de 12
 * personas los colores se repiten, así que el color NUNCA puede ser el
 * único identificador. Las vistas de planificación muestran siempre las
 * iniciales junto al color (`AbsenceCalendarMonth`, `AbsenceLegend`).
 *
 * Iconos: el sistema usa una única familia, Lucide (`@lucide/svelte`,
 * contorno, cuadrícula 24 px, trazo 2 — docs/BECALL-SISTEMA-DISENO.md §18).
 * `AbsenceIcon` es el tipo mínimo que cumple cualquier componente de
 * `@lucide/svelte`; el consumidor decide qué icono corresponde a cada
 * subtipo de ausencia (formación, permiso, desplazamiento...).
 */
import type { Component } from "svelte";

/** Componente de icono aceptado por las vistas de ausencias (cualquier icono de `@lucide/svelte`). */
export type AbsenceIcon = Component<{ size?: string | number; class?: string }>;

/**
 * Iniciales de un nombre: primera letra de las dos primeras palabras
 * significativas, en mayúsculas ("Hugo Beltrán" → "HB", "Ana" → "A").
 * Ignora partículas habituales ("de", "del", "la", "y"...) para que
 * "María de la Fuente" dé "MF" y no "MD".
 */
export function employeeInitials(name: string): string {
	const particles = new Set(["de", "del", "la", "las", "los", "y", "i", "da", "do", "dos", "van", "von"]);
	const words = name
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0 && !particles.has(word.toLowerCase()));
	return words
		.slice(0, 2)
		.map((word) => word.charAt(0).toLocaleUpperCase("es-ES"))
		.join("");
}
