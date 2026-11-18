<script lang="ts">
	/**
	 * AbsenceCalendarEmployee — vista de UN empleado (Historias.md §5.1,
	 * "consulta de empleado") — tercer componente nuevo de Fase 3. A
	 * diferencia de `AbsenceCalendarMonth` (varios empleados, un mes) y
	 * `AbsenceCalendarYear` (todos los empleados mezclados, un punto
	 * neutro "con ausencias"), esta vista filtra a UN empleado concreto y
	 * combina dos piezas:
	 *
	 *   1. Un mapa anual de 12 mini-meses (mismo esqueleto visual que
	 *      `AbsenceCalendarYear`) donde cada día cubierto por una ausencia
	 *      de ESTE empleado se tiñe con SU PROPIO color de la paleta
	 *      categórica (`employeeColorVar(employeeColorIndex)`), con la
	 *      misma distinción de FORMA que `AbsenceCalendarMonth`
	 *      (vacation/single-day = relleno sólido; other = borde
	 *      discontinuo + relleno tenue) — aquí SÍ tiene sentido colorear
	 *      por tipo de ausencia (no por empleado, ya resuelto por filtrar
	 *      a uno) porque es la única vista donde "qué tipo" importa más
	 *      que "quién".
	 *   2. Una lista de las ausencias individuales de ese empleado,
	 *      reutilizando `AdaptiveDataView` (Fase 4 ya resuelto) en vez de
	 *      inventar una tabla nueva — mismo criterio que el resto del
	 *      paquete: una pieza compuesta de piezas ya existentes y
	 *      verificadas, no una reimplementación.
	 *
	 * `entries` llega ya filtrado a un empleado (mismo patrón "tonto"/
	 * composable que `AbsenceCalendarMonth`/`Year`: este componente no
	 * conoce `employeeId`, solo pinta lo que le pasan) — el consumidor
	 * decide cómo filtra (p. ej. `entries.filter(e => e.employeeId === id)`
	 * antes de pasarlo aquí).
	 *
	 * `isHoliday`/`isNoService`: misma firma y mismos tokens
	 * (`--absence-holiday-bg`/`--absence-no-service-bg`) que el resto de
	 * la familia — aquí tiñen el FONDO de la celda, igual que
	 * `AbsenceCalendarYear`, porque conviven con el indicador de ausencia
	 * en la misma celda pequeña. Sin `hasCoverageDeficit`/
	 * `hasBalanceDiscrepancy` (v0.16.0, sí presentes en `Month`/`Year`):
	 * "déficit de cobertura" es un concepto de DEPARTAMENTO, no de una
	 * persona sola, y "discrepancia de saldo" de un empleado concreto ya
	 * lo cubre el banner `Alert`/`FormError` resuelto en Fase 2 — un
	 * anillo más en una vista ya de una sola persona no añade nada que el
	 * banner no diga mejor con texto.
	 *
	 * Teclado (v0.16.0 — antes cada día visible era su propio parón de
	 * Tab): mismo roving tabindex + `yearGridKeyboard.ts` compartido que
	 * `AbsenceCalendarYear` — ver su comentario de cabecera para el porqué
	 * de la delegación en el contenedor exterior en vez de por `<tbody>`.
	 */
	import { untrack } from "svelte";
	import {
		getMonthMatrix,
		isSameDay,
		toISODate,
		fromISODate,
		formatDateES,
		addDays,
		isAfterDay,
		MONTH_NAMES_ES,
		WEEKDAY_LABELS_ES,
		WEEKDAY_NAMES_ES
	} from "../forms/dateUtils.js";
	import { employeeColorVar, ABSENCE_TYPE_LABELS_ES } from "../tokens/index.js";
	import { AdaptiveDataView } from "../data/index.js";
	import type { DataColumn } from "../data/types.js";
	import { nextFocusedDay, clampToYear } from "./yearGridKeyboard.js";
	import type { AbsenceEntry } from "./types.js";

	interface Props {
		/** Año del mapa anual mostrado (p. ej. 2026). */
		year: number;
		employeeName: string;
		employeeColorIndex: number;
		/** Ausencias de ESTE empleado, ya filtradas por el consumidor (ver comentario de arriba). */
		entries: AbsenceEntry[];
		isHoliday?: (d: Date) => boolean;
		isNoService?: (d: Date) => boolean;
		/** Si se pasa, cada día del mapa anual se vuelve clicable (p. ej. para saltar a `AbsenceCalendarMonth` con ese mes) — también activa el roving tabindex del teclado. */
		onDayClick?: (iso: string) => void;
		/** Si se pasa, cada fila de la lista de ausencias se vuelve clicable. */
		onEntryClick?: (entry: AbsenceEntry) => void;
		id?: string;
		class?: string;
	}

	let {
		year,
		employeeName,
		employeeColorIndex,
		entries,
		isHoliday,
		isNoService,
		onDayClick,
		onEntryClick,
		id,
		class: className = ""
	}: Props = $props();

	let today = new Date();

	// Roving tabindex (ver comentario de cabecera) — mismo patrón que
	// `AbsenceCalendarYear`.
	let focused = $state(untrack(() => new Date(year, 0, 1)));
	let containerEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		focused = new Date(year, 0, 1);
	});

	function focusCell(d: Date) {
		focused = clampToYear(d, year);
		queueMicrotask(() => {
			containerEl?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
		});
	}

	function onGridKeydown(e: KeyboardEvent) {
		if (!onDayClick) return;
		const next = nextFocusedDay(focused, year, e.key);
		if (!next) return;
		e.preventDefault();
		focusCell(next);
	}

	/**
	 * Mapa fecha ISO → entrada que la cubre, para pintar el mapa anual.
	 * A diferencia de `AbsenceCalendarYear.absenceDates` (un `Set`, solo
	 * "¿hay algo este día?"), aquí hace falta la entrada completa (tipo +
	 * color) para decidir sólido/discontinuo. Si dos entradas del mismo
	 * empleado se solaparan un día (no debería pasar, pero no es cosa de
	 * este componente validarlo), gana la última del array — mismo
	 * criterio de "el consumidor ordena su array como quiere que se
	 * pinte" que el desempate de `laneLayout.ts`.
	 */
	let dayToEntry = $derived.by(() => {
		const map = new Map<string, AbsenceEntry>();
		for (const entry of entries) {
			const start = fromISODate(entry.start);
			const end = fromISODate(entry.end);
			if (!start || !end) continue;
			let d = start;
			while (!isAfterDay(d, end)) {
				map.set(toISODate(d), entry);
				d = addDays(d, 1);
			}
		}
		return map;
	});

	function monthWeeks(month: number) {
		const matrix = getMonthMatrix(year, month);
		const out: (typeof matrix)[] = [];
		for (let i = 0; i < matrix.length; i += 7) out.push(matrix.slice(i, i + 7));
		return out;
	}

	function dayLabel(d: Date, holiday: boolean, noService: boolean, entry: AbsenceEntry | undefined): string {
		const base = d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
		const tags = [holiday && "festivo", noService && "sin servicio", entry && ABSENCE_TYPE_LABELS_ES[entry.type]].filter(
			Boolean
		);
		return tags.length ? `${base} (${tags.join(", ")})` : base;
	}

	function dayCount(entry: AbsenceEntry): number {
		const start = fromISODate(entry.start);
		const end = fromISODate(entry.end);
		if (!start || !end) return 0;
		let n = 0;
		let d = start;
		while (!isAfterDay(d, end)) {
			n++;
			d = addDays(d, 1);
		}
		return n;
	}

	let sortedEntries = $derived([...entries].sort((a, b) => a.start.localeCompare(b.start)));

	// Las 4 columnas necesitan formato propio (etiqueta es-ES del tipo,
	// fecha dd/mm/aaaa en vez del ISO interno, nº de días calculado) —
	// ninguna puede caer al `String(row[key])` por defecto de `DataColumn`,
	// así que las 4 traen su propio `cell` (snippets declarados más abajo,
	// fuera de `<script>` — ver AGENTS.md sobre por qué un snippet referenciado
	// aquí arriba funciona: se compila a una función de nivel de módulo,
	// izada igual que cualquier `function` declarada en el componente).
	let columns: DataColumn<AbsenceEntry>[] = [
		{ key: "type", label: "Tipo", cell: typeCell },
		{ key: "start", label: "Inicio", cell: startCell },
		{ key: "end", label: "Fin", cell: endCell },
		{ key: "days", label: "Días", align: "end", cell: daysCell }
	];

	function rowKey(entry: AbsenceEntry): string {
		return entry.id;
	}
</script>

{#snippet typeCell(entry: AbsenceEntry)}
	{ABSENCE_TYPE_LABELS_ES[entry.type]}{entry.subtype ? ` — ${entry.subtype}` : ""}
{/snippet}

{#snippet startCell(entry: AbsenceEntry)}
	{formatDateES(fromISODate(entry.start))}
{/snippet}

{#snippet endCell(entry: AbsenceEntry)}
	{formatDateES(fromISODate(entry.end))}
{/snippet}

{#snippet daysCell(entry: AbsenceEntry)}
	{dayCount(entry)}
{/snippet}

<div {id} class="gg-absence-employee {className}">
	<!--
		svelte-ignore a11y_no_noninteractive_element_interactions -- mismo
		patrón de delegación que `AbsenceCalendarYear` (ver su comentario de
		cabecera): roving tabindex sobre doce `<table>` independientes.
	-->
	<div
		class="gg-absence-employee__year"
		bind:this={containerEl}
		role="group"
		aria-label={`Mapa anual de ${employeeName}, ${year}`}
		onkeydown={onGridKeydown}
	>
		{#each Array.from({ length: 12 }, (_, i) => i) as month (month)}
			<div class="gg-absence-employee__month">
				<p class="gg-absence-employee__month-label">{MONTH_NAMES_ES[month]}</p>
				<table class="gg-absence-employee__grid" aria-label={`${MONTH_NAMES_ES[month]} de ${year}, ${employeeName}`}>
					<thead>
						<tr>
							{#each WEEKDAY_LABELS_ES as label, i (label)}
								<th scope="col" abbr={WEEKDAY_NAMES_ES[i]}>{label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each monthWeeks(month) as week, wi (wi)}
							<tr>
								{#each week as day (day.date.getTime())}
									{#if day.outside}
										<td><span class="gg-absence-employee__day gg-absence-employee__day--empty" aria-hidden="true"></span></td>
									{:else}
										{@const iso = toISODate(day.date)}
										{@const holiday = isHoliday?.(day.date) ?? false}
										{@const noService = isNoService?.(day.date) ?? false}
										{@const entry = dayToEntry.get(iso)}
										{@const variant = entry ? (entry.type === "other" ? "outline" : "solid") : undefined}
										{@const isToday = isSameDay(day.date, today)}
										{@const label = dayLabel(day.date, holiday, noService, entry)}
										<td>
											{#if onDayClick}
												<button
													type="button"
													class="gg-absence-employee__day"
													class:gg-absence-employee__day--holiday={holiday}
													class:gg-absence-employee__day--no-service={noService}
													class:gg-absence-employee__day--today={isToday}
													class:gg-absence-employee__day--solid={variant === "solid"}
													class:gg-absence-employee__day--outline={variant === "outline"}
													style={entry ? `--gg-absence-color:${employeeColorVar(employeeColorIndex)};` : undefined}
													tabindex={isSameDay(day.date, focused) ? 0 : -1}
													aria-label={label}
													onclick={() => {
														focused = day.date;
														onDayClick(iso);
													}}
												></button>
											{:else}
												<span
													class="gg-absence-employee__day"
													class:gg-absence-employee__day--holiday={holiday}
													class:gg-absence-employee__day--no-service={noService}
													class:gg-absence-employee__day--today={isToday}
													class:gg-absence-employee__day--solid={variant === "solid"}
													class:gg-absence-employee__day--outline={variant === "outline"}
													style={entry ? `--gg-absence-color:${employeeColorVar(employeeColorIndex)};` : undefined}
													role="img"
													aria-label={label}
												></span>
											{/if}
										</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	</div>

	<div class="gg-absence-employee__list">
		<AdaptiveDataView
			data={sortedEntries}
			{columns}
			{rowKey}
			onRowClick={onEntryClick}
		>
			{#snippet empty()}
				<p class="gg-absence-employee__empty">Sin ausencias registradas.</p>
			{/snippet}
		</AdaptiveDataView>
	</div>
</div>

<style>
	.gg-absence-employee {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.gg-absence-employee__year {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-4);
	}

	.gg-absence-employee__month {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-absence-employee__month-label {
		margin: 0;
		padding: 0;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-transform: capitalize;
	}

	.gg-absence-employee__grid {
		border-collapse: collapse;
		width: 100%;
	}

	.gg-absence-employee__grid th {
		padding-block-end: var(--space-1);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-label-weight);
	}

	.gg-absence-employee__grid td {
		padding: 1px;
		text-align: center;
	}

	.gg-absence-employee__day {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-4);
		height: var(--space-4);
		border: none;
		border-radius: var(--radius-xs);
		background: var(--surface-sunken);
	}

	.gg-absence-employee__day--empty {
		background: transparent;
	}

	button.gg-absence-employee__day {
		cursor: pointer;
	}

	button.gg-absence-employee__day:hover {
		background: var(--border-subtle);
	}

	button.gg-absence-employee__day:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	.gg-absence-employee__day--holiday {
		background: var(--absence-holiday-bg);
	}

	.gg-absence-employee__day--no-service {
		background: var(--absence-no-service-bg);
		border: 1px dashed var(--text-muted);
	}

	.gg-absence-employee__day--today {
		box-shadow: inset 0 0 0 1.5px var(--focus);
	}

	/* "Periodo de vacaciones"/"días sueltos" sobre este día — relleno
	   sólido del color PROPIO del empleado (mismo token que su barra en
	   `AbsenceCalendarMonth`), manda sobre festivo/sin servicio igual que
	   en esa vista: una ausencia real es más relevante que el fondo del
	   día. */
	.gg-absence-employee__day--solid {
		background: var(--gg-absence-color);
	}

	/* "Otra ausencia" — distinción de FORMA (borde discontinuo), no solo
	   de color, mismo criterio que `AbsenceCalendarMonth`. */
	.gg-absence-employee__day--outline {
		background: color-mix(in srgb, var(--gg-absence-color) 30%, var(--surface));
		border: 1.5px dashed var(--gg-absence-color);
	}

	.gg-absence-employee__empty {
		margin: 0;
		padding: var(--space-4) 0;
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		text-align: center;
	}
</style>
