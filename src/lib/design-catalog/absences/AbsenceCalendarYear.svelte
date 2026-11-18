<script lang="ts">
	/**
	 * AbsenceCalendarYear — vista anual "tipo mapa" (Historias.md §5.1,
	 * "mapa anual") — segundo componente nuevo de Fase 3. A diferencia de
	 * `AbsenceCalendarMonth` (detalle: nombre de cada empleado, barras de
	 * varios días), esta es una vista de CONJUNTO: 12 mini-meses en
	 * cuadrícula, pensada para detectar de un vistazo qué zonas del año
	 * tienen ausencias/festivos, no para leer QUIÉN está ausente cada día
	 * — eso ya lo da `AbsenceCalendarMonth` (`onDayClick` de aquí está
	 * pensado para saltar a esa vista con el día elegido).
	 *
	 * Por eso cada celda de día es un cuadrado sin número visible (como un
	 * mapa de calor de contribuciones, no una tabla de fechas) — a esta
	 * densidad (hasta 371 celdas a la vez) un número de 1-2 dígitos sería
	 * ilegible en los anchos pequeños que pide "responsive desde 360px".
	 * El nombre accesible completo (fecha + festivo/sin servicio/con
	 * ausencias) vive en `aria-label`, nunca solo en el color (WCAG 1.4.1):
	 * festivo/sin servicio reutilizan los mismos tokens day-level que
	 * `Calendar.svelte`/`AbsenceCalendarMonth`
	 * (`--absence-holiday-bg`/`--absence-no-service-bg`), y "con
	 * ausencias" es un punto NO coloreado (▪, color de texto, no de
	 * estado) para que siga siendo visible en escala de grises.
	 *
	 * Excepción deliberada a la densidad táctil (`docs/TOKENS.md`,
	 * "--target-min"): estas celdas son de VISTA GENERAL, no un control
	 * primario — igual que las barras de `AbsenceCalendarMonth` o una fila
	 * de `DataTable`, agrandarlas a 44px multiplicaría la altura de la
	 * página por una vista que ya tiene su detalle accesible en
	 * `AbsenceCalendarMonth`.
	 *
	 * Responsive desde 360px (candidato #161): `grid-template-columns:
	 * repeat(auto-fit, minmax(...))` — ninguna media query de viewport ni
	 * de contenedor, los mini-meses se reflowan solos según el ancho
	 * disponible, 1 columna en un móvil estrecho y varias en desktop.
	 *
	 * `hasCoverageDeficit`/`hasBalanceDiscrepancy` (v0.16.0, mismo
	 * mecanismo day-level que `isHoliday`/`isNoService` — ver el
	 * comentario completo en `AbsenceCalendarMonth.svelte`): a esta
	 * densidad no cabe un icono por marca, así que se pintan como un
	 * anillo (`box-shadow` inset, `--status-warning`) alrededor de la
	 * celda — una pista de FORMA más, nunca solo color, que se suma a las
	 * ya existentes (festivo/sin servicio en el fondo, "con ausencias"
	 * como punto) y queda recogida en el `aria-label` igual que el resto.
	 *
	 * Teclado (v0.16.0 — antes cada día visible era su propio parón de
	 * Tab, hasta 371 en un año completo): roving tabindex sobre los
	 * botones de día + delegación de `onkeydown` en el contenedor exterior
	 * (doce `<table>` independientes, no una única cuadrícula) — ver
	 * `yearGridKeyboard.ts` para la matemática compartida con
	 * `AbsenceCalendarEmployee`. Solo activo cuando se pasa `onDayClick`,
	 * mismo criterio que `AbsenceCalendarMonth`: sin ningún botón de día,
	 * no hay nada que mover el foco entre.
	 */
	import { untrack } from "svelte";
	import {
		getMonthMatrix,
		isSameDay,
		toISODate,
		fromISODate,
		addDays,
		isAfterDay,
		MONTH_NAMES_ES,
		WEEKDAY_LABELS_ES,
		WEEKDAY_NAMES_ES
	} from "../forms/dateUtils.js";
	import { nextFocusedDay, clampToYear } from "./yearGridKeyboard.js";
	import { employeeColorVar } from "../tokens/absence.js";
	import { tooltip } from "../feedback/tooltip.js";
	import { portal } from "../feedback/portal.js";
	import Button from "../buttons/Button.svelte";
	import { ABSENCE_TYPE_LABELS_ES } from "../tokens/index.js";
	import type { Snippet } from "svelte";
	import type { AbsenceEntry } from "./types.js";

	interface Props {
		year: number;
		entries: AbsenceEntry[];
		isHoliday?: (d: Date) => boolean;
		/** v1.8.0: nombre del festivo de un día (`undefined` si no tiene) — lo añade al tooltip y al nombre accesible del día. */
		holidayName?: (d: Date) => string | undefined;
		isNoService?: (d: Date) => boolean;
		/** Marca un día con déficit de cobertura — ver comentario de cabecera y `AbsenceCalendarMonth.svelte`. */
		hasCoverageDeficit?: (d: Date) => boolean;
		/** Marca un día con una discrepancia de saldo pendiente de validar — ver comentario de cabecera. */
		hasBalanceDiscrepancy?: (d: Date) => boolean;
		/** Si se pasa, cada día se vuelve clicable (p. ej. para abrir ese día en `AbsenceCalendarMonth`) — también activa el roving tabindex del teclado. */
		onDayClick?: (iso: string) => void;
		/** Si se pasa, la cabecera de cada mes se vuelve clicable (p. ej. para abrir ese mes en `AbsenceCalendarMonth`). */
		onMonthClick?: (month: number) => void;
		/**
		 * v1.12.0 — desplegable de anotación. Al pulsar un día CON ausencias se abre un panel junto a la celda
		 * con cada anotación del día (persona, tipo y fechas). Se activa si se pasa alguno de los tres
		 * callbacks o `entryPanel`; `onDayClick` se sigue llamando siempre.
		 */
		onEntryCorrect?: (entry: AbsenceEntry, iso: string) => void;
		onEntryChangeType?: (entry: AbsenceEntry, iso: string) => void;
		onEntryDelete?: (entry: AbsenceEntry, iso: string) => void;
		/** Sustituye el contenido del panel (el paquete solo pone la cáscara: posición, foco, Escape y clic fuera). */
		entryPanel?: Snippet<[{ iso: string; entries: AbsenceEntry[]; close: () => void }]>;
		id?: string;
		class?: string;
	}

	let {
		year,
		entries,
		isHoliday,
		holidayName,
		isNoService,
		hasCoverageDeficit,
		hasBalanceDiscrepancy,
		onDayClick,
		onMonthClick,
		onEntryCorrect,
		onEntryChangeType,
		onEntryDelete,
		entryPanel,
		id,
		class: className = ""
	}: Props = $props();

	let today = new Date();

	// Roving tabindex (ver comentario de cabecera) — `focused` arranca en
	// el 1 de enero del `year` mostrado (`untrack`: solo hace falta un
	// valor INICIAL) y se recoloca ahí cada vez que `year` cambia.
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

	// Expande cada ausencia a sus fechas ISO y agrupa por día las PERSONAS
	// ausentes (una vez cada una, en el orden de `entries`) — una sola pasada
	// para los 12 meses, no una por mini-mes. v1.7.0: de aquí salen las
	// franjas de color, el tooltip y el nombre accesible con quién falta.
	type AbsentPerson = { employeeId: string; name: string; colorIndex: number };
	let absentByDate = $derived.by(() => {
		const map = new Map<string, AbsentPerson[]>();
		for (const entry of entries) {
			const start = fromISODate(entry.start);
			const end = fromISODate(entry.end);
			if (!start || !end) continue;
			let d = start;
			while (!isAfterDay(d, end)) {
				const iso = toISODate(d);
				const people = map.get(iso) ?? [];
				if (!people.some((p) => p.employeeId === entry.employeeId)) {
					people.push({ employeeId: entry.employeeId, name: entry.employeeName, colorIndex: entry.employeeColorIndex });
					map.set(iso, people);
				}
				d = addDays(d, 1);
			}
		}
		return map;
	});

	// v1.12.0 — las anotaciones de cada día (para el desplegable).
	let entriesByDate = $derived.by(() => {
		const map = new Map<string, AbsenceEntry[]>();
		for (const entry of entries) {
			const start = fromISODate(entry.start);
			const end = fromISODate(entry.end);
			if (!start || !end) continue;
			let d = start;
			while (!isAfterDay(d, end)) {
				const iso = toISODate(d);
				const list = map.get(iso) ?? [];
				list.push(entry);
				map.set(iso, list);
				d = addDays(d, 1);
			}
		}
		return map;
	});

	const panelEnabled = $derived(Boolean(onEntryCorrect || onEntryChangeType || onEntryDelete || entryPanel));
	let panel: { iso: string; entries: AbsenceEntry[]; anchor: HTMLElement; top: number; left: number } | null = $state(null);
	let panelEl: HTMLDivElement | undefined = $state();
	const panelUid = $props.id();

	function openPanel(iso: string, anchor: HTMLElement) {
		const list = entriesByDate.get(iso) ?? [];
		if (!panelEnabled || list.length === 0) {
			panel = null;
			return;
		}
		const r = anchor.getBoundingClientRect();
		panel = { iso, entries: list, anchor, top: r.bottom, left: r.left };
		queueMicrotask(placePanel);
	}

	// Coloca el panel bajo la celda y lo voltea/ajusta si no cabe en la ventana; luego mueve el foco dentro.
	function placePanel() {
		if (!panel || !panelEl) return;
		const a = panel.anchor.getBoundingClientRect();
		const w = panelEl.offsetWidth;
		const h = panelEl.offsetHeight;
		const gap = 4;
		let top = a.bottom + gap;
		if (top + h > window.innerHeight && a.top - gap - h >= 0) top = a.top - gap - h;
		let left = Math.min(a.left, window.innerWidth - w - gap);
		left = Math.max(gap, left);
		panel.top = top;
		panel.left = left;
		panelEl.querySelector<HTMLElement>("button:not([disabled])")?.focus({ preventScroll: true });
	}

	function closePanel(refocus: boolean) {
		const anchor = panel?.anchor;
		panel = null;
		if (refocus) anchor?.focus();
	}

	function runAction(fn: ((entry: AbsenceEntry, iso: string) => void) | undefined, entry: AbsenceEntry) {
		const iso = panel?.iso;
		closePanel(true);
		if (iso) fn?.(entry, iso);
	}

	$effect(() => {
		if (!panel) return;
		function onPointerDown(e: PointerEvent) {
			const t = e.target as Node;
			if (panelEl?.contains(t) || panel?.anchor.contains(t)) return;
			closePanel(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				closePanel(true);
			}
		}
		// Un scroll que no mueve la celda (p. ej. el que provoca el propio clic o el foco) no cierra el panel.
		const opened = panel.anchor.getBoundingClientRect();
		function onScroll() {
			const now = panel?.anchor.getBoundingClientRect();
			if (now && Math.abs(now.top - opened.top) < 1 && Math.abs(now.left - opened.left) < 1) return;
			closePanel(false);
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey, true);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey, true);
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
		};
	});

	function rangeLabel(e: AbsenceEntry): string {
		const a = fromISODate(e.start);
		const b = fromISODate(e.end);
		if (!a || !b) return "";
		const f = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
		return e.start === e.end ? f(a) : `${f(a)} – ${f(b)}`;
	}

	// Como mucho MAX_STRIPES franjas por celda (a 16px no caben más
	// distinguibles): con más personas, las primeras MAX_STRIPES-1 llevan su
	// color y la última es neutra (--text-primary) y significa «y más»; el
	// tooltip y el aria-label nombran a todas.
	const MAX_STRIPES = 4;
	function stripesOf(people: AbsentPerson[]): { key: string; color: string }[] {
		if (people.length <= MAX_STRIPES) {
			return people.map((p) => ({ key: p.employeeId, color: employeeColorVar(p.colorIndex) }));
		}
		return [
			...people.slice(0, MAX_STRIPES - 1).map((p) => ({ key: p.employeeId, color: employeeColorVar(p.colorIndex) })),
			{ key: "more", color: "var(--text-primary)" }
		];
	}

	// v1.8.0: con `holidayName` el tooltip también dice qué festivo es: «12 de octubre: Festivo: Hispanidad · Fuera: Ana».
	// Sin nombre de festivo conserva el formato de 1.7.0 («12 de octubre: Ana, Luis»).
	function tooltipOf(d: Date, people: AbsentPerson[], holiday: string | undefined): string {
		if (people.length === 0 && !holiday) return "";
		const date = d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
		const names = people.map((p) => p.name).join(", ");
		if (!holiday) return `${date}: ${names}`;
		return `${date}: Festivo: ${holiday}${people.length > 0 ? ` · Fuera: ${names}` : ""}`;
	}

	function monthWeeks(month: number) {
		const matrix = getMonthMatrix(year, month);
		const out: (typeof matrix)[] = [];
		for (let i = 0; i < matrix.length; i += 7) out.push(matrix.slice(i, i + 7));
		return out;
	}

	function dayLabel(d: Date, holiday: boolean, holidayLabel: string | undefined, noService: boolean, people: AbsentPerson[], deficit: boolean, discrepancy: boolean): string {
		const base = d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
		const tags = [
			holiday && (holidayLabel ? `festivo: ${holidayLabel}` : "festivo"),
			noService && "sin servicio",
			people.length > 0 && `fuera: ${people.map((p) => p.name).join(", ")}`,
			deficit && "déficit de cobertura",
			discrepancy && "discrepancia de saldo pendiente de validar"
		].filter(Boolean);
		return tags.length ? `${base} (${tags.join(", ")})` : base;
	}
</script>

{#snippet stripes(people: AbsentPerson[])}
	<span class="gg-absence-year__stripes" aria-hidden="true">
		{#each stripesOf(people) as stripe (stripe.key)}
			<span class="gg-absence-year__stripe" style:background={stripe.color}></span>
		{/each}
	</span>
{/snippet}

<!--
	svelte-ignore a11y_no_noninteractive_element_interactions -- mismo
	patrón de delegación que `Calendar.svelte`/`AbsenceCalendarMonth`: el
	roving tabindex necesita UN único `onkeydown` en el contenedor exterior
	(aquí, por encima de los doce `<table>` independientes).
-->
<div
	{id}
	bind:this={containerEl}
	class="gg-absence-year {className}"
	role="group"
	aria-label={`Mapa anual de ausencias de ${year}`}
	onkeydown={onGridKeydown}
>
	{#each Array.from({ length: 12 }, (_, i) => i) as month (month)}
		<div class="gg-absence-year__month">
			{#if onMonthClick}
				<button type="button" class="gg-absence-year__month-label" onclick={() => onMonthClick(month)}>
					{MONTH_NAMES_ES[month]}
				</button>
			{:else}
				<p class="gg-absence-year__month-label gg-absence-year__month-label--static">{MONTH_NAMES_ES[month]}</p>
			{/if}
			<table class="gg-absence-year__grid" aria-label={`${MONTH_NAMES_ES[month]} de ${year}`}>
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
									<td><span class="gg-absence-year__day gg-absence-year__day--empty" aria-hidden="true"></span></td>
								{:else}
									{@const iso = toISODate(day.date)}
									{@const holiday = isHoliday?.(day.date) ?? false}
									{@const holidayLabel = holiday ? holidayName?.(day.date) : undefined}
									{@const noService = isNoService?.(day.date) ?? false}
									{@const people = absentByDate.get(iso) ?? []}
									{@const deficit = hasCoverageDeficit?.(day.date) ?? false}
									{@const discrepancy = hasBalanceDiscrepancy?.(day.date) ?? false}
									{@const isToday = isSameDay(day.date, today)}
									{@const label = dayLabel(day.date, holiday, holidayLabel, noService, people, deficit, discrepancy)}
									<td>
										{#if onDayClick}
											<button
												type="button"
												class="gg-absence-year__day"
												class:gg-absence-year__day--holiday={holiday}
												class:gg-absence-year__day--no-service={noService}
												class:gg-absence-year__day--today={isToday}
												class:gg-absence-year__day--flagged={deficit || discrepancy}
												tabindex={isSameDay(day.date, focused) ? 0 : -1}
												aria-label={label}
												use:tooltip={{ content: tooltipOf(day.date, people, holidayLabel) }}
												aria-haspopup={panelEnabled && people.length > 0 ? "dialog" : undefined}
												aria-expanded={panelEnabled && people.length > 0 ? panel?.iso === iso : undefined}
												onclick={(e) => {
													focused = day.date;
													onDayClick(iso);
													openPanel(iso, e.currentTarget);
												}}
											>
												{#if people.length > 0}{@render stripes(people)}{/if}
											</button>
										{:else}
											<span
												class="gg-absence-year__day"
												class:gg-absence-year__day--holiday={holiday}
												class:gg-absence-year__day--no-service={noService}
												class:gg-absence-year__day--today={isToday}
												class:gg-absence-year__day--flagged={deficit || discrepancy}
												role="img"
												aria-label={label}
												use:tooltip={{ content: tooltipOf(day.date, people, holidayLabel) }}
											>
												{#if people.length > 0}{@render stripes(people)}{/if}
											</span>
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

{#if panel}
	<div
		bind:this={panelEl}
		use:portal
		class="gg-absence-year__panel bc-glass bc-glass--elevated bc-anim-pop"
		role="dialog"
		aria-label={`Anotaciones del ${fromISODate(panel.iso)?.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`}
		style:top="{panel.top}px"
		style:left="{panel.left}px"
	>
		{#if entryPanel}
			{@render entryPanel({ iso: panel.iso, entries: panel.entries, close: () => closePanel(true) })}
		{:else}
			<ul class="gg-absence-year__panel-list">
				{#each panel.entries as entry (entry.id)}
					<li class="gg-absence-year__panel-item" aria-labelledby="{panelUid}-{entry.id}">
						<span class="gg-absence-year__panel-swatch" style:background={employeeColorVar(entry.employeeColorIndex)} aria-hidden="true"></span>
						<div class="gg-absence-year__panel-text">
							<p class="gg-absence-year__panel-name" id="{panelUid}-{entry.id}">{entry.employeeName}</p>
							<p class="gg-absence-year__panel-meta">{ABSENCE_TYPE_LABELS_ES[entry.type]}{entry.subtype ? ` · ${entry.subtype}` : ""} · {rangeLabel(entry)}</p>
						</div>
						<div class="gg-absence-year__panel-actions">
							{#if onEntryCorrect}
								<Button size="sm" variant="secondary" onclick={() => runAction(onEntryCorrect, entry)}>Corregir anotación</Button>
							{/if}
							{#if onEntryChangeType}
								<Button size="sm" variant="ghost" onclick={() => runAction(onEntryChangeType, entry)}>Cambiar tipo</Button>
							{/if}
							{#if onEntryDelete}
								<Button size="sm" variant="ghost" onclick={() => runAction(onEntryDelete, entry)}>Borrar</Button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.gg-absence-year {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-4);
	}

	.gg-absence-year__month {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-absence-year__month-label {
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-align: start;
		text-transform: capitalize;
	}

	button.gg-absence-year__month-label {
		cursor: pointer;
	}

	button.gg-absence-year__month-label:hover {
		text-decoration: underline;
	}

	button.gg-absence-year__month-label:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-absence-year__grid {
		border-collapse: collapse;
		width: 100%;
	}

	.gg-absence-year__grid th {
		padding-block-end: var(--space-1);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-overline-size);
		font-weight: var(--text-label-weight);
	}

	.gg-absence-year__grid td {
		padding: 1px;
		text-align: center;
	}

	.gg-absence-year__day {
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

	.gg-absence-year__day--empty {
		background: transparent;
	}

	button.gg-absence-year__day {
		cursor: pointer;
	}

	button.gg-absence-year__day:hover {
		background: var(--border-subtle);
	}

	button.gg-absence-year__day:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}

	.gg-absence-year__day--holiday {
		background: var(--absence-holiday-bg);
	}

	.gg-absence-year__day--no-service {
		background: var(--absence-no-service-bg);
		border: 1px dashed var(--text-muted);
	}

	.gg-absence-year__day--today {
		box-shadow: inset 0 0 0 1.5px var(--focus);
	}

	/* Déficit de cobertura/discrepancia de saldo (v0.16.0) — a esta
	   densidad no cabe un icono por marca (ver comentario de cabecera),
	   así que es un anillo en vez de un relleno: una pista de FORMA más,
	   combinada con --status-warning (uso no textual, ≥3:1 ya verificado)
	   y siempre recogida en aria-label, nunca solo este color. Si el día
	   es además "hoy", el anillo de --focus manda (ya es la pista de
	   estado más urgente de la celda). */
	.gg-absence-year__day--flagged:not(.gg-absence-year__day--today) {
		box-shadow: inset 0 0 0 1.5px var(--status-warning);
	}

	/* Franjas "quién está fuera" (v1.7.0; sustituyen al punto neutro de
	   v0.16.0). Una franja vertical por persona con su color de empleado
	   (`employeeColorVar`), en la mitad INFERIOR de la celda: la superior
	   deja ver el fondo de festivo/sin servicio, que sigue siendo la pista
	   de esos estados. El color nunca va solo: el nombre accesible y el
	   tooltip nombran a las personas (WCAG 1.4.1). Contraste no textual de
	   cada color ≥3:1 con superficie y festivo (generate-tokens.mjs). */
	.gg-absence-year__day {
		position: relative;
	}

	.gg-absence-year__stripes {
		position: absolute;
		inset-inline: 2px;
		inset-block-end: 2px;
		display: flex;
		gap: 1px;
		height: 50%;
	}

	.gg-absence-year__stripe {
		flex: 1;
		min-width: 0;
		border-radius: 1px;
	}

	/* v1.12.0 — desplegable de anotación (portado al body: position fixed). */
	.gg-absence-year__panel {
		box-sizing: border-box;
		position: fixed;
		z-index: var(--z-dropdown);
		min-width: var(--space-64);
		max-width: min(24rem, calc(100vw - var(--space-4) * 2));
		padding: var(--space-3);
		--bc-glass-tint: var(--surface-overlay);
		--bc-glass-shadow: var(--shadow-floating);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.gg-absence-year__panel-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-absence-year__panel-item {
		display: grid;
		grid-template-columns: var(--space-2) 1fr;
		column-gap: var(--space-2);
		row-gap: var(--space-2);
		align-items: start;
	}

	.gg-absence-year__panel-swatch {
		align-self: stretch;
		border-radius: var(--radius-xs);
	}

	.gg-absence-year__panel-name {
		margin: 0;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
	}

	.gg-absence-year__panel-meta {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-absence-year__panel-actions {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
