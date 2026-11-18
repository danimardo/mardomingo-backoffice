<script lang="ts">
	/**
	 * AbsenceLegend — leyenda de la familia de ausencias (Historias.md
	 * §5.1), pensada para acompañar a `AbsenceCalendarMonth`/`Year`/
	 * `Employee`: traduce a palabras lo que esas vistas solo comunican con
	 * color/forma, requisito de cada una de ellas (WCAG 1.4.1, "nunca solo
	 * color") — esta es la pieza que completa esa promesa con el texto
	 * explícito que un `aria-label` no sustituye del todo para un usuario
	 * VIDENTE que simplemente no conoce la convención todavía.
	 *
	 * Tres bloques, en el mismo orden en que aparecen las vistas:
	 *   1. Tipo de ausencia — `ABSENCE_TYPE_LABELS_ES` con la misma
	 *      distinción de FORMA que las barras/celdas reales (sólido para
	 *      vacation/single-day, borde discontinuo + relleno tenue para
	 *      other) — un color NEUTRO (`--text-muted`), no el de ningún
	 *      empleado, porque esta fila explica el TIPO, no a una persona.
	 *   2. Día especial — festivo/sin servicio, mismos tokens day-level
	 *      que `Calendar.svelte`/el resto de la familia.
	 *   3. Empleados (opcional, solo si el consumidor pasa `employees`) —
	 *      un punto con el color categórico real de cada empleado + su
	 *      nombre, para que el lector sepa qué color es cuál en la vista
	 *      que esté mirando a la vez (Historias.md §4.1: el color persiste
	 *      por empleado, así que esta lista es estable sesión a sesión).
	 *
	 * Colapsable (en escritorio, abierta por defecto; en móvil, donde el
	 * espacio vertical es el recurso escaso en una pantalla ya ocupada por
	 * el calendario, conviene poder plegarla) con `<details>`/`<summary>`
	 * NATIVOS — foco/Intro/Espacio funcionan sin JS propio y sin
	 * reinventar el patrón de disclosure que accordion.md ya resolvió en
	 * Fase 5 (mismo criterio de "semántica nativa antes que ARIA a mano"
	 * que `DataTable`/`Calendar`).
	 */
	import { ABSENCE_TYPE_LABELS_ES, employeeColorVar, type AbsenceType } from "../tokens/index.js";
	import { employeeInitials } from "./identity.js";

	interface LegendEmployee {
		name: string;
		colorIndex: number;
		/** v1.1.0: iniciales mostradas sobre el color; si se omiten se calculan de `name`. */
		initials?: string;
	}

	interface Props {
		/** Si se pasa, añade el bloque "Empleados" con un punto de color real por persona. */
		employees?: LegendEmployee[];
		/** Abierta por defecto (ver comentario de cabecera) — el consumidor puede forzarla cerrada en un layout muy apretado. */
		open?: boolean;
		id?: string;
		class?: string;
	}

	let { employees = [], open = true, id, class: className = "" }: Props = $props();

	const ABSENCE_TYPES: AbsenceType[] = ["vacation", "single-day", "other"];
</script>

<details {id} class="gg-absence-legend {className}" {open}>
	<summary class="gg-absence-legend__summary">Leyenda</summary>

	<div class="gg-absence-legend__body">
		<ul class="gg-absence-legend__group">
			{#each ABSENCE_TYPES as type (type)}
				<li class="gg-absence-legend__item">
					<span
						class="gg-absence-legend__swatch gg-absence-legend__swatch--{type === 'other' ? 'outline' : 'solid'}"
						aria-hidden="true"
					></span>
					{ABSENCE_TYPE_LABELS_ES[type]}
				</li>
			{/each}
			<li class="gg-absence-legend__item">
				<span class="gg-absence-legend__swatch gg-absence-legend__swatch--holiday" aria-hidden="true"></span>
				Festivo
			</li>
			<li class="gg-absence-legend__item">
				<span class="gg-absence-legend__swatch gg-absence-legend__swatch--no-service" aria-hidden="true"></span>
				Sin servicio
			</li>
		</ul>

		{#if employees.length > 0}
			<ul class="gg-absence-legend__group">
				{#each employees as employee (employee.name + employee.colorIndex)}
					<li class="gg-absence-legend__item">
						<span
							class="gg-absence-legend__dot"
							style={`background:${employeeColorVar(employee.colorIndex)};`}
							aria-hidden="true"
						>{employee.initials ?? employeeInitials(employee.name)}</span>
						{employee.name}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</details>

<style>
	.gg-absence-legend {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--surface);
	}

	.gg-absence-legend__summary {
		padding: var(--space-3);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		cursor: pointer;
		list-style: none;
	}

	.gg-absence-legend__summary::-webkit-details-marker {
		display: none;
	}

	/* Flecha propia (en vez del triángulo nativo del navegador, que varía
	   de estilo entre navegadores) — mismo icono de dirección que el resto
	   del paquete (Accordion/Dropdown). */
	.gg-absence-legend__summary::before {
		display: inline-block;
		margin-inline-end: var(--space-2);
		content: "▸";
		color: var(--text-muted);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-absence-legend[open] > .gg-absence-legend__summary::before {
		transform: rotate(90deg);
	}

	.gg-absence-legend__summary:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-absence-legend__body {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-5);
		padding: 0 var(--space-3) var(--space-3);
	}

	.gg-absence-legend__group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-absence-legend__item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-absence-legend__swatch {
		display: inline-block;
		box-sizing: border-box;
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--radius-xs);
	}

	/* Mismo criterio de color NEUTRO que el comentario de cabecera — esta
	   fila enseña la FORMA (sólido/discontinuo), no el color de nadie. */
	.gg-absence-legend__swatch--solid {
		background: var(--text-muted);
	}

	.gg-absence-legend__swatch--outline {
		background: color-mix(in srgb, var(--text-muted) 18%, var(--surface));
		border: 1.5px dashed var(--text-muted);
	}

	.gg-absence-legend__swatch--holiday {
		background: var(--absence-holiday-bg);
		border: 1px solid var(--border-subtle);
	}

	.gg-absence-legend__swatch--no-service {
		background: var(--absence-no-service-bg);
		border: 1px dashed var(--text-muted);
	}

	/* v1.1.0: el punto lleva las iniciales (segundo canal de identidad; la
	   paleta de 12 colores se repite con más personas). Texto en
	   --employee-on-color, verificado ≥4.5:1 contra los 12 colores. */
	.gg-absence-legend__dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--space-6);
		height: var(--space-5);
		padding-inline: var(--space-1);
		border-radius: var(--radius-full);
		color: var(--employee-on-color);
		font-size: var(--text-caption-size);
		font-weight: 600;
	}
</style>
