<script lang="ts">
	/**
	 * AbsenceCalendarMonth — vista mensual MULTI-PERSONA (Historias.md
	 * §5.1, "vista mensual") — primer componente nuevo de Fase 3 (ronda de
	 * ampliación UX post-v0.14.0). A diferencia de `Calendar.svelte`
	 * (interno, de SELECCIÓN de una fecha para `DatePicker`/
	 * `DateRangePicker`), esta es una pieza de VISUALIZACIÓN: pensada para
	 * página completa (embebible, no un popover), muestra las ausencias de
	 * varios empleados a la vez sobre la misma cuadrícula de mes.
	 *
	 * Una ausencia de varios días se dibuja como UNA barra continua que
	 * cruza las celdas de esa semana (mismo lenguaje visual que la vista
	 * de mes de Google Calendar/Outlook para eventos de varios días) — ver
	 * `laneLayout.ts` para el algoritmo de empaquetado en carriles
	 * (independiente por semana) y el desbordamiento a "+N" cuando hay más
	 * ausencias simultáneas que `maxLanes`.
	 *
	 * Identidad de empleado = COLOR (paleta categórica de Fase 2,
	 * `employeeColorVar()`), nunca solo color: cada barra lleva el NOMBRE
	 * del empleado como texto (en la primera columna que ocupa esa semana,
	 * no repetido día a día) como identificador principal, y el TIPO de
	 * ausencia (vacation/single-day = barra sólida; other = barra con
	 * borde discontinuo y relleno tenue) es una distinción de FORMA, no
	 * solo de color — mismo criterio que el borde discontinuo de
	 * `Calendar.svelte` para "día sin servicio".
	 *
	 * `isHoliday`/`isNoService`: misma firma y mismos tokens
	 * (`--absence-holiday-bg`/`--absence-no-service-bg`) que
	 * `Calendar.svelte` — aquí tiñen la celda del día entera, no un botón
	 * redondo, porque esta cuadrícula es de visualización de ancho
	 * completo, no un selector compacto.
	 *
	 * `hasCoverageDeficit`/`hasBalanceDiscrepancy` (feedback real del
	 * desarrollador frontend consumidor, v0.15.0 → v0.16.0): marcas de
	 * NIVEL DE DÍA que complementan — no sustituyen — los avisos `Alert`/
	 * `FormError` tipo banner ya resueltos en Fase 2 (déficit de cobertura/
	 * discrepancia de saldo pendiente de validar, no bloqueantes). El icono
	 * concreto de cada una es un PLACEHOLDER genérico (triángulo de aviso/
	 * punto de interrogación en `--status-warning`, uso no textual ≥3:1 ya
	 * verificado) a la espera del set de iconos del diseñador externo —
	 * mismo criterio ya aplicado a la paleta de empleado: el `aria-label`
	 * es el canal accesible definitivo desde ya, el icono se puede
	 * sustituir después sin tocar la API. Solo en vistas de DEPARTAMENTO
	 * (`AbsenceCalendarMonth`/`Year`) — `AbsenceCalendarEmployee` es una
	 * vista de una sola persona, donde "déficit de cobertura" no aplica.
	 *
	 * Teclado (v0.16.0 — antes cada día/barra/overflow era su propio
	 * parón de Tab, interminable con un departamento grande): roving
	 * tabindex sobre los botones de DÍA, mismo patrón WAI-ARIA que
	 * `Calendar.svelte` (una única `tabindex="0"`, el resto `-1`, flechas/
	 * Home/End mueven el foco real) — SOLO cuando se pasa `onDayClick`,
	 * que es lo que convierte el día en el único punto de entrada por
	 * teclado. Las barras de ausencia y el indicador "+N" pasan entonces a
	 * `tabindex="-1"` (atajo de ratón/táctil adicional, mismo criterio ya
	 * usado en los botones +/- de `NumberInput`): acceder a sus detalles
	 * por teclado es responsabilidad de lo que el consumidor abra en
	 * `onDayClick` (p. ej. una lista de ese día con `AdaptiveDataView`,
	 * igual que hace `AbsenceCalendarEmployee`), no de esta cuadrícula.
	 * Sin `onDayClick` no hay ningún botón de día que mover el foco entre
	 * — las barras/overflow (si llevan `onEntryClick`/`onOverflowClick`)
	 * se quedan en su `tabindex` natural, único punto de entrada posible
	 * en ese caso.
	 */
	import { untrack } from "svelte";
	import {
		getMonthMatrix,
		isSameDay,
		isBeforeDay,
		isAfterDay,
		toISODate,
		addDays,
		MONTH_NAMES_ES,
		WEEKDAY_LABELS_ES,
		WEEKDAY_NAMES_ES
	} from "../forms/dateUtils.js";
	import { employeeColorVar, ABSENCE_TYPE_LABELS_ES } from "../tokens/index.js";
	import { computeWeekLayout } from "./laneLayout.js";
	import { employeeInitials } from "./identity.js";
	import Scale from "../icons/scale.svelte";
	import TriangleAlert from "../icons/triangle-alert.svelte";
	import { tooltip } from "../feedback/tooltip.js";
	import Dialog from "../feedback/Dialog.svelte";
	import Button from "../buttons/Button.svelte";
	import type { AbsenceEntry, CoverageNotice } from "./types.js";

	interface Props {
		/** Año del mes mostrado (p. ej. 2026). */
		year: number;
		/** Mes mostrado, 0-11. */
		month: number;
		entries: AbsenceEntry[];
		isHoliday?: (d: Date) => boolean;
		isNoService?: (d: Date) => boolean;
		/** Marca un día con déficit de cobertura (p. ej. nadie cubre ese turno) — ver comentario de cabecera. */
		hasCoverageDeficit?: (d: Date) => boolean;
		/**
		 * v1.7.0 — aviso de cobertura explicado: si devuelve un aviso, el día lleva el triángulo como BOTÓN (tooltip con
		 * `summary`; al pulsarlo, un diálogo con `detail` y el enlace). Implica déficit aunque no se pase
		 * `hasCoverageDeficit`. Sin esta prop, el triángulo es el icono informativo de 1.6.0.
		 */
		coverageNotice?: (d: Date) => CoverageNotice | undefined;
		/** Marca un día con una discrepancia de saldo pendiente de validar — ver comentario de cabecera. */
		hasBalanceDiscrepancy?: (d: Date) => boolean;
		/** Carriles visibles como máximo por semana antes de desbordar a "+N" — por defecto 3 (una celda de día razonable en móvil ya no da para mucho más). */
		maxLanes?: number;
		/** Si se pasa, la fecha ("aaaa-mm-dd") del día se vuelve clicable — también activa el roving tabindex del teclado (ver comentario de cabecera). */
		onDayClick?: (iso: string) => void;
		/** Si se pasa, cada barra de ausencia se vuelve clicable. */
		onEntryClick?: (entry: AbsenceEntry) => void;
		/** Si se pasa, el indicador "+N" se vuelve clicable (p. ej. para abrir un detalle del día con todas las ausencias). */
		onOverflowClick?: (iso: string) => void;
		/**
		 * v1.3.0 — Re Pág (`-1`) y Av Pág (`1`) con el foco en la rejilla piden cambiar de mes. El componente no
		 * conoce el mes siguiente (`year`/`month` son props), así que lo decide el consumidor. Solo con `onDayClick`.
		 */
		onMonthChange?: (delta: -1 | 1) => void;
		id?: string;
		class?: string;
	}

	let {
		year,
		month,
		entries,
		isHoliday,
		isNoService,
		hasCoverageDeficit,
		coverageNotice,
		hasBalanceDiscrepancy,
		maxLanes = 3,
		onDayClick,
		onEntryClick,
		onOverflowClick,
		onMonthChange,
		id,
		class: className = ""
	}: Props = $props();

	let today = new Date();

	// Diálogo del aviso de cobertura (v1.7.0): uno solo para todo el mes.
	let noticeOpen = $state(false);
	let activeNotice = $state<{ date: Date; notice: CoverageNotice } | undefined>(undefined);
	let noticeTrigger: HTMLElement | undefined;

	function openNotice(date: Date, notice: CoverageNotice, trigger: HTMLElement) {
		activeNotice = { date, notice };
		noticeTrigger = trigger;
		noticeOpen = true;
	}

	function closeNotice() {
		noticeOpen = false;
		queueMicrotask(() => noticeTrigger?.focus());
	}

	function noticeTitle(d: Date): string {
		return `Aviso de cobertura del ${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]}`;
	}

	let weeks = $derived.by(() => {
		const matrix = getMonthMatrix(year, month);
		const out: (typeof matrix)[] = [];
		for (let i = 0; i < matrix.length; i += 7) out.push(matrix.slice(i, i + 7));
		return out;
	});

	// Roving tabindex (ver comentario de cabecera) — `focused` arranca en
	// el día 1 del mes mostrado (`untrack`: solo hace falta un valor
	// INICIAL, igual que `DatePicker.svelte`/`AbsenceRangeCalendar.svelte`)
	// y se recoloca ahí cada vez que el consumidor cambia `year`/`month`
	// (mismo criterio que el propio `DatePicker` al cambiar de mes: el
	// foco vuelve a un punto conocido en vez de quedar "fantasma" fuera de
	// la cuadrícula nueva).
	let focused = $state(untrack(() => new Date(year, month, 1)));
	let gridEl: HTMLTableSectionElement | undefined = $state();

	$effect(() => {
		focused = new Date(year, month, 1);
	});

	let matrixBounds = $derived.by(() => {
		const matrix = getMonthMatrix(year, month);
		return { first: matrix[0]!.date, last: matrix[41]!.date };
	});

	function clampToMatrix(d: Date): Date {
		const { first, last } = matrixBounds;
		if (isBeforeDay(d, first)) return first;
		if (isAfterDay(d, last)) return last;
		return d;
	}

	function focusCell(d: Date) {
		focused = clampToMatrix(d);
		queueMicrotask(() => {
			gridEl?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
		});
	}

	/**
	 * v1.3.0 — nombre accesible del botón de día: fecha completa, festivo, sin servicio, ausencias (persona y tipo)
	 * y avisos. Empieza por el número visible (WCAG 2.5.3, etiqueta en el nombre).
	 */
	function dayLabel(d: Date, flags: { holiday: boolean; noService: boolean; deficit: boolean; discrepancy: boolean }): string {
		const iso = toISODate(d);
		const parts = [
			`${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]} de ${d.getFullYear()}, ${WEEKDAY_NAMES_ES[(d.getDay() + 6) % 7]?.toLowerCase() ?? ""}`
		];
		if (flags.holiday) parts.push("festivo");
		if (flags.noService) parts.push("sin servicio");
		const present = entries.filter((entry) => entry.start <= iso && iso <= entry.end);
		if (present.length > 0) {
			parts.push(
				present
					.map((entry) => `${entry.employeeName}: ${entry.subtype ?? ABSENCE_TYPE_LABELS_ES[entry.type]}`)
					.join("; ")
			);
		} else {
			parts.push("sin ausencias");
		}
		if (flags.deficit) parts.push("déficit de cobertura");
		if (flags.discrepancy) parts.push("discrepancia de saldo pendiente de validar");
		return parts.join(". ");
	}

	function onGridKeydown(e: KeyboardEvent) {
		// Sin `onDayClick` no hay roving tabindex que mover (ver comentario
		// de cabecera) — se deja que el navegador maneje Tab normal sobre
		// lo que sí sea focusable (barras/overflow en su tabindex natural).
		if (!onDayClick) return;
		if (e.key === "ArrowRight") {
			e.preventDefault();
			focusCell(addDays(focused, 1));
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			focusCell(addDays(focused, -1));
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			focusCell(addDays(focused, 7));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			focusCell(addDays(focused, -7));
		} else if (e.key === "Home") {
			e.preventDefault();
			focusCell(addDays(focused, -((focused.getDay() + 6) % 7)));
		} else if (e.key === "End") {
			e.preventDefault();
			focusCell(addDays(focused, 6 - ((focused.getDay() + 6) % 7)));
		} else if (e.key === "PageUp" && onMonthChange) {
			e.preventDefault();
			onMonthChange(-1);
		} else if (e.key === "PageDown" && onMonthChange) {
			e.preventDefault();
			onMonthChange(1);
		}
		// Intro/Espacio: el propio <button> nativo del día ya dispara su
		// `onclick` -> `onDayClick`, no hace falta repetirlo aquí.
	}
</script>

<table {id} class="gg-absence-month {className}" aria-label={`Ausencias de ${MONTH_NAMES_ES[month]} de ${year}`}>
	<thead>
		<tr>
			{#each WEEKDAY_LABELS_ES as label, i (label)}
				<th scope="col" abbr={WEEKDAY_NAMES_ES[i]}>{label}</th>
			{/each}
		</tr>
	</thead>
	<!--
		svelte-ignore a11y_no_noninteractive_element_interactions -- mismo
		patrón de delegación que `Calendar.svelte`: el roving tabindex de
		los botones de día necesita UN único `onkeydown` en el contenedor,
		no uno por botón.
	-->
	<tbody bind:this={gridEl} onkeydown={onGridKeydown}>
		{#each weeks as week, wi (wi)}
			{@const weekDates = week.map((d) => d.date)}
			{@const layout = computeWeekLayout(weekDates, entries, maxLanes)}
			<tr>
				{#each week as day, di (day.date.getTime())}
					{@const iso = toISODate(day.date)}
					{@const isToday = isSameDay(day.date, today)}
					{@const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6}
					{@const holiday = isHoliday?.(day.date) ?? false}
					{@const noService = isNoService?.(day.date) ?? false}
					{@const notice = day.outside ? undefined : coverageNotice?.(day.date)}
					{@const deficit = notice !== undefined || (hasCoverageDeficit?.(day.date) ?? false)}
					{@const discrepancy = hasBalanceDiscrepancy?.(day.date) ?? false}
					<td
						class="gg-absence-month__cell"
						class:gg-absence-month__cell--outside={day.outside}
						class:gg-absence-month__cell--weekend={isWeekend}
						class:gg-absence-month__cell--holiday={holiday}
						class:gg-absence-month__cell--no-service={noService}
					>
						{#if onDayClick}
							<button
								type="button"
								class="gg-absence-month__day-num"
								class:gg-absence-month__day-num--today={isToday}
								tabindex={isSameDay(day.date, focused) ? 0 : -1}
								aria-label={dayLabel(day.date, { holiday, noService, deficit, discrepancy })}
								onclick={() => {
									focused = day.date;
									onDayClick(iso);
								}}
							>
								{day.date.getDate()}
							</button>
						{:else}
							<span class="gg-absence-month__day-num" class:gg-absence-month__day-num--today={isToday}>
								{day.date.getDate()}
							</span>
						{/if}

						{#if deficit || discrepancy}
							<span class="gg-absence-month__markers">
								{#if notice}
									<button
										type="button"
										class="gg-absence-month__marker gg-absence-month__marker--deficit gg-absence-month__marker--button"
										aria-label={`Aviso de cobertura: ${notice.summary}`}
										aria-haspopup="dialog"
										title={notice.summary}
										use:tooltip={{ content: notice.summary, placement: "bottom" }}
										onclick={(e) => openNotice(day.date, notice, e.currentTarget)}
									>
										<TriangleAlert size="0.85em" aria-hidden="true" />
									</button>
								{:else if deficit}
									<span class="gg-absence-month__marker gg-absence-month__marker--deficit" role="img" aria-label="Déficit de cobertura">
										<TriangleAlert size="0.85em" aria-hidden="true" />
									</span>
								{/if}
								{#if discrepancy}
									<span class="gg-absence-month__marker gg-absence-month__marker--discrepancy" role="img" aria-label="Discrepancia de saldo pendiente de validar">
										<Scale size="0.85em" aria-hidden="true" />
									</span>
								{/if}
							</span>
						{/if}

						{#each layout.lanes as lane, li (li)}
							{@const placement = lane[di]}
							{#if placement}
								{@const isStartHere = placement.startCol === di}
								{@const isEndHere = placement.endCol === di}
								{@const variant = placement.entry.type === "other" ? "outline" : "solid"}
								{@const barLabel = `${placement.entry.employeeName} — ${ABSENCE_TYPE_LABELS_ES[placement.entry.type]}${placement.entry.subtype ? ` (${placement.entry.subtype})` : ""}`}
								{#if onEntryClick}
									<button
										type="button"
										class="gg-absence-bar gg-absence-bar--{variant}"
										class:gg-absence-bar--round-start={isStartHere && placement.isTrueStart}
										class:gg-absence-bar--round-end={isEndHere && placement.isTrueEnd}
										style={`--gg-absence-color:${employeeColorVar(placement.entry.employeeColorIndex)};`}
										tabindex={onDayClick ? -1 : undefined}
										title={barLabel}
										aria-label={barLabel}
										onclick={() => onEntryClick(placement.entry)}
									>
										{#if isStartHere}
											{@const Icon = placement.entry.icon}
											{#if Icon}<span class="gg-absence-bar__icon" aria-hidden="true"><Icon size="1em" /></span>{/if}
											<span class="gg-absence-bar__initials" aria-hidden="true">{placement.entry.employeeInitials ?? employeeInitials(placement.entry.employeeName)}</span>
											<span class="gg-absence-bar__name">{placement.entry.employeeName}</span>
										{/if}
									</button>
								{:else}
									<div
										class="gg-absence-bar gg-absence-bar--{variant}"
										class:gg-absence-bar--round-start={isStartHere && placement.isTrueStart}
										class:gg-absence-bar--round-end={isEndHere && placement.isTrueEnd}
										style={`--gg-absence-color:${employeeColorVar(placement.entry.employeeColorIndex)};`}
										title={barLabel}
									>
										{#if isStartHere}
											{@const Icon = placement.entry.icon}
											{#if Icon}<span class="gg-absence-bar__icon" aria-hidden="true"><Icon size="1em" /></span>{/if}
											<span class="gg-absence-bar__initials" aria-hidden="true">{placement.entry.employeeInitials ?? employeeInitials(placement.entry.employeeName)}</span>
											<span class="gg-absence-bar__name">{placement.entry.employeeName}</span>
										{/if}
									</div>
								{/if}
							{:else}
								<div class="gg-absence-bar gg-absence-bar--spacer" aria-hidden="true"></div>
							{/if}
						{/each}

						{#if (layout.overflowByDay[di] ?? 0) > 0}
							{#if onOverflowClick}
								<button
									type="button"
									class="gg-absence-month__overflow"
									tabindex={onDayClick ? -1 : undefined}
									onclick={() => onOverflowClick(iso)}
								>
									+{layout.overflowByDay[di]}
								</button>
							{:else}
								<span class="gg-absence-month__overflow">+{layout.overflowByDay[di]}</span>
							{/if}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

{#if activeNotice}
	<Dialog bind:open={noticeOpen} title={noticeTitle(activeNotice.date)} size="sm" onClose={closeNotice}>
		<div class="gg-absence-month__notice">
			{#each activeNotice.notice.detail as paragraph, pi (pi)}
				<p>{paragraph}</p>
			{/each}
		</div>
		{#snippet footer()}
			{#if activeNotice?.notice.href}
				<Button variant="primary" href={activeNotice.notice.href}>{activeNotice.notice.linkLabel ?? "Abrir"}</Button>
			{/if}
			<Button variant="secondary" onclick={closeNotice}>Cerrar</Button>
		{/snippet}
	</Dialog>
{/if}

<style>
	.gg-absence-month {
		border-collapse: collapse;
		table-layout: fixed;
		width: 100%;
	}

	.gg-absence-month th {
		padding-block-end: var(--space-2);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
	}

	.gg-absence-month__cell {
		position: relative;
		box-sizing: border-box;
		width: calc(100% / 7);
		vertical-align: top;
		padding: var(--space-1);
		border: 1px solid var(--border-subtle);
	}

	/* Marcas de déficit de cobertura/discrepancia de saldo (ver comentario
	   de cabecera) — esquina superior derecha de la celda, nunca encima
	   del número de día ni de las barras. `--status-warning` en uso NO
	   textual (icono, ≥3:1 ya verificado) — el canal accesible real es el
	   `aria-label` de cada icono, no el color ni la posición. */
	.gg-absence-month__markers {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		display: flex;
		gap: 2px;
	}

	.gg-absence-month__marker {
		display: inline-flex;
		color: var(--status-warning);
	}

	/* v1.7.0 — con `coverageNotice` el triángulo es un botón (tooltip al
	   pasar o enfocar; diálogo al pulsar). Sin fondo ni borde para no
	   cambiar el aspecto de 1.6.0. Área pulsable mínima de 24×24 px
	   (WCAG 2.5.8, AA) sin tapar el número del día: el margen negativo la
	   deja crecer hacia la esquina en vez de empujar el contenido. */
	.gg-absence-month__marker--button {
		box-sizing: border-box;
		align-items: center;
		justify-content: center;
		min-width: var(--space-6);
		min-height: var(--space-6);
		margin: calc(var(--space-1) * -1);
		padding: var(--space-1);
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		cursor: pointer;
		font: inherit;
	}

	.gg-absence-month__marker--button:hover {
		background: var(--border-subtle);
	}

	.gg-absence-month__marker--button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	.gg-absence-month__notice {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
	}

	.gg-absence-month__notice p {
		margin: 0;
	}

	.gg-absence-month__cell--outside {
		background: var(--surface-sunken);
	}

	/* v1.3.0: --text-disabled sobre --surface-sunken daba 2,83:1 (WCAG AA exige 4,5:1 en un texto que se lee).
	   El día de otro mes ya se distingue por el fondo; el número usa el texto secundario. */
	.gg-absence-month__cell--outside .gg-absence-month__day-num {
		color: var(--text-secondary);
	}

	.gg-absence-month__cell--weekend {
		background: color-mix(in srgb, var(--surface-sunken) 50%, var(--surface));
	}

	/* Festivo/sin servicio mandan sobre el tinte de fin de semana — un
	   sábado festivo sigue siendo, antes que nada, festivo. */
	.gg-absence-month__cell--holiday {
		background: var(--absence-holiday-bg);
	}

	.gg-absence-month__cell--no-service {
		background: var(--absence-no-service-bg);
	}

	.gg-absence-month__day-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-width: var(--space-6);
		height: var(--space-6);
		margin-block-end: var(--space-1);
		padding-inline: var(--space-1);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	button.gg-absence-month__day-num {
		cursor: pointer;
	}

	/* v1.3.0: con puntero grueso el botón del día mide al menos --target-min (44 px) en ambos ejes. */
	@media (pointer: coarse) {
		button.gg-absence-month__day-num {
			min-width: var(--target-min);
			min-height: var(--target-min);
		}
	}

	button.gg-absence-month__day-num:hover {
		background: var(--surface-sunken);
	}

	button.gg-absence-month__day-num:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-absence-month__day-num--today {
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	.gg-absence-bar {
		box-sizing: border-box;
		display: block;
		width: 100%;
		margin-block-end: var(--space-1);
		padding-inline: var(--space-1);
		border: none;
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: 1.6;
		/* v1.3.2: una barra sin texto (los días de continuación de un periodo y los huecos de carril) mide lo mismo que la
		   que lleva el nombre; sin esto medía 0 y solo se veía el primer día. */
		min-block-size: calc(var(--text-caption-size) * 1.6);
		text-align: start;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		/* v1.1.0: icono + iniciales + nombre en fila; solo el nombre se
		   recorta, las iniciales (segundo canal de identidad) siempre caben. */
		align-items: center;
		gap: var(--space-1);
	}

	.gg-absence-bar:not(.gg-absence-bar--spacer) {
		display: flex;
	}

	.gg-absence-bar__icon {
		display: inline-flex;
		flex: none;
	}

	.gg-absence-bar__initials {
		flex: none;
		font-weight: 600;
	}

	.gg-absence-bar__name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* "Periodo de vacaciones"/"días sueltos" — relleno sólido del color de
	   empleado, texto en --employee-on-color (ver tokens.css, verificado
	   ≥4.5:1 contra los 8 swatches de cada tema). */
	.gg-absence-bar--solid {
		background: var(--gg-absence-color);
		color: var(--employee-on-color);
		cursor: default;
	}

	button.gg-absence-bar--solid {
		cursor: pointer;
	}

	/* "Otra ausencia" (formación/permiso/desplazamiento) — distinción de
	   FORMA, no solo de color (WCAG 1.4.1): borde discontinuo + relleno
	   tenue del color de empleado, en vez de sólido. */
	.gg-absence-bar--outline {
		background: color-mix(in srgb, var(--gg-absence-color) 18%, var(--surface));
		border: 1.5px dashed var(--gg-absence-color);
		color: var(--text-primary);
		cursor: default;
	}

	button.gg-absence-bar--outline {
		cursor: pointer;
	}

	.gg-absence-bar--round-start {
		border-start-start-radius: var(--radius-sm);
		border-end-start-radius: var(--radius-sm);
	}

	.gg-absence-bar--round-end {
		border-start-end-radius: var(--radius-sm);
		border-end-end-radius: var(--radius-sm);
	}

	.gg-absence-bar:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	.gg-absence-bar--spacer {
		background: transparent;
		visibility: hidden;
	}

	.gg-absence-month__overflow {
		display: block;
		box-sizing: border-box;
		width: 100%;
		margin-block-start: var(--space-1);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		text-align: start;
	}

	button.gg-absence-month__overflow {
		cursor: pointer;
	}

	button.gg-absence-month__overflow:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	button.gg-absence-month__overflow:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}
</style>
