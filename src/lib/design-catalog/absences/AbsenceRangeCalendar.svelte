<script lang="ts">
	/**
	 * AbsenceRangeCalendar — selección de un rango de fechas para REGISTRAR
	 * una ausencia nueva (Historias.md §5.1: el complemento de las vistas
	 * de solo lectura `AbsenceCalendarMonth`/`Year`/`Employee` — aquella
	 * familia MUESTRA ausencias ya existentes, esta es la pieza para
	 * CREAR una). A diferencia de `DatePicker`/`DateRangePicker` (campo de
	 * texto + calendario emergente en un popover), aquí el calendario es
	 * la pieza entera, pensada para vivir embebida de forma permanente en
	 * una página (p. ej. junto a un formulario de "nueva ausencia" con el
	 * empleado/tipo elegidos aparte) — por eso no hay ningún campo de
	 * texto ni lógica de apertura/cierre, reutiliza directamente
	 * `Calendar.svelte` (la misma cuadrícula interna de `DateRangePicker`,
	 * con su teclado completo y su roving tabindex ya resueltos) con la
	 * cabecera de navegación de mes que `DateRangePicker` monta alrededor.
	 *
	 * Selección por CLIC/toque (dos pasos: el primer clic fija el inicio y
	 * borra el fin, el segundo fija el fin — si cae antes del inicio, se
	 * intercambian, mismo flujo que `DateRangePicker`) Y por TECLADO
	 * (Intro/Espacio sobre el día enfocado, heredado tal cual de
	 * `Calendar.svelte` — nada nuevo que mantener aquí). El ARRASTRE
	 * (`allowDrag`) es un AÑADIDO opcional y NO EXCLUSIVO: con el ratón
	 * pulsado sobre un día y sin soltar, mover el puntero a otro día fija
	 * el rango de un solo gesto; soltar sin haberse movido de día no hace
	 * nada además de lo que ya hace el clic normal (se deja que el
	 * `onSelect` nativo de `Calendar` procese ese caso, evitando fijar el
	 * mismo rango dos veces). El arrastre se apoya en `onHoverDate`, que
	 * `Calendar` YA dispara en cada `mouseenter`/`mouseleave` de un botón
	 * de día (para la previsualización de `DateRangePicker`) — aquí se
	 * reutiliza ese mismo dato como "qué día hay bajo el puntero" sin que
	 * `Calendar.svelte` necesite saber nada de arrastre.
	 *
	 * `startDate`/`endDate`/`minDate`/`maxDate`: `string` "aaaa-mm-dd"
	 * (ISO) en la API pública, igual que `DateRangePicker` — `Date` sigue
	 * siendo solo el tipo de cálculo interno (`dateUtils.ts`).
	 */
	import { untrack } from "svelte";
	import Calendar from "../forms/Calendar.svelte";
	import { formatDateES, clampDate, isAfterDay, isSameDay, toISODate, fromISODate } from "../forms/dateUtils.js";
	import { Icon } from "../icons/index.js";

	interface Props {
		startDate?: string | null;
		endDate?: string | null;
		minDate?: string | null;
		maxDate?: string | null;
		isHoliday?: (d: Date) => boolean;
		isNoService?: (d: Date) => boolean;
		/**
		 * Permite fijar el rango completo arrastrando de un día a otro, sin
		 * dejar de poder usarlo a dos clics/teclado (ver comentario de
		 * cabecera) — por defecto `false`: el arrastre es fácil de disparar
		 * sin querer en una tabla con una celda por día, así que cada
		 * consumidor lo activa a propósito.
		 */
		allowDrag?: boolean;
		/** Se dispara cuando el rango cambia, por cualquiera de los tres caminos (clic, teclado o arrastre). */
		onRangeChange?: (start: string, end: string | null) => void;
		id?: string;
		class?: string;
	}

	let {
		startDate = $bindable(null),
		endDate = $bindable(null),
		minDate = null,
		maxDate = null,
		isHoliday,
		isNoService,
		allowDrag = false,
		onRangeChange,
		id,
		class: className = ""
	}: Props = $props();

	let minD = $derived(fromISODate(minDate));
	let maxD = $derived(fromISODate(maxDate));
	let startD = $derived(fromISODate(startDate));
	let endD = $derived(fromISODate(endDate));

	// `untrack`: solo hace falta un valor INICIAL de mes enfocado — mismo
	// motivo y mismo patrón que `DatePicker.svelte`/`DateRangePicker` no
	// tiene (ahí `focused` arranca directo a `new Date()`, pero aquí sí
	// conviene abrir ya centrado en `startDate` si el consumidor lo pasa).
	let focused = $state(untrack(() => clampDate(fromISODate(startDate) ?? new Date(), minD, maxD)));

	// Arrastre (ver comentario de cabecera): `hoveredDate` es "qué día hay
	// bajo el puntero ahora mismo" (actualizado por el mismo `onHoverDate`
	// que ya usa `DateRangePicker` para su previsualización); `dragStart`
	// solo existe mientras el botón del ratón está pulsado.
	let hoveredDate: Date | null = $state(null);
	let dragStart: Date | null = $state(null);
	let dragging = $derived(dragStart !== null);
	// Evita que el `onclick` nativo del día (que `Calendar` dispara justo
	// después de un `mouseup`) vuelva a procesar como "segundo clic" un
	// rango que el arrastre ya acaba de fijar en ese mismo gesto.
	let suppressNextSelect = false;

	// Rango mostrado: el COMITIDO normalmente, o el PROVISIONAL del
	// arrastre en curso (ordenado inicio<=fin) mientras `dragging` es
	// `true` — `Calendar` ya sabe pintar inicio/fin/en-rango a partir de
	// estas dos props, así que el arrastre no necesita CSS propio.
	let previewStart = $derived.by(() => {
		if (dragging && dragStart && hoveredDate) return isAfterDay(dragStart, hoveredDate) ? hoveredDate : dragStart;
		return startD;
	});
	let previewEnd = $derived.by(() => {
		if (dragging && dragStart && hoveredDate) return isAfterDay(dragStart, hoveredDate) ? dragStart : hoveredDate;
		return endD;
	});

	function commitRange(start: Date, end: Date | null) {
		startDate = toISODate(start);
		endDate = end ? toISODate(end) : null;
		onRangeChange?.(startDate, endDate);
	}

	function selectDate(d: Date) {
		if (suppressNextSelect) {
			suppressNextSelect = false;
			return;
		}
		if (!startD || endD) {
			commitRange(d, null);
		} else if (isAfterDay(startD, d)) {
			commitRange(d, startD);
		} else {
			commitRange(startD, d);
		}
	}

	function onPointerDown() {
		if (!allowDrag || !hoveredDate) return;
		dragStart = hoveredDate;
	}

	function onPointerUp() {
		if (!dragStart) return;
		const end = hoveredDate;
		const start = dragStart;
		dragStart = null;
		if (end && !isSameDay(start, end)) {
			commitRange(isAfterDay(start, end) ? end : start, isAfterDay(start, end) ? start : end);
			suppressNextSelect = true;
		}
		// Si no hubo movimiento de día (clic simple), no se hace nada
		// extra aquí — el `onclick` nativo del botón ya dispara `selectDate`
		// con la lógica normal de dos pasos.
	}
</script>

<svelte:window onmouseup={onPointerUp} />

<!--
	svelte-ignore a11y_no_noninteractive_element_interactions -- el
	`onmousedown` de aquí es solo el inicio del arrastre OPCIONAL
	(`allowDrag`, ver comentario de cabecera); la selección real sigue
	siendo 100% accesible por teclado/clic a través de `Calendar.svelte`
	(mismo criterio que su propio `onkeydown` de delegación en `<tbody>`).
-->
<div {id} class="gg-absence-range {className}" role="group" aria-label="Selector de rango de fechas" onmousedown={onPointerDown}>
	<div class="gg-absence-range__nav">
		<button
			type="button"
			class="gg-absence-range__nav-btn"
			aria-label="Mes anterior"
			onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() - 1, 1))}
		>
			<Icon
				name="chevron-left"
				size="1em"
				legacySvg={{
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.8",
					body: '<path d="M10 3l-5 5 5 5" />'
				}}
			/>
		</button>
		<span class="gg-absence-range__nav-label" aria-hidden="true">
			{focused.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
		</span>
		<button
			type="button"
			class="gg-absence-range__nav-btn"
			aria-label="Mes siguiente"
			onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() + 1, 1))}
		>
			<Icon
				name="chevron-right"
				size="1em"
				legacySvg={{
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.8",
					body: '<path d="M6 3l5 5-5 5" />'
				}}
			/>
		</button>
	</div>

	<Calendar
		bind:focused
		minDate={minD}
		maxDate={maxD}
		selectedStart={previewStart}
		selectedEnd={previewEnd}
		onSelect={selectDate}
		onHoverDate={(d) => (hoveredDate = d)}
		{isHoliday}
		{isNoService}
	/>

	<p class="gg-absence-range__summary" aria-live="polite">
		{#if startD && endD}
			{formatDateES(startD)} – {formatDateES(endD)}
		{:else if startD}
			Inicio: {formatDateES(startD)} — elige el día de fin
		{:else}
			Elige el día de inicio
		{/if}
	</p>
</div>

<style>
	.gg-absence-range {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.gg-absence-range__nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.gg-absence-range__nav-label {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-transform: capitalize;
	}

	.gg-absence-range__nav-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-6);
		height: var(--space-6);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — mismo
	   criterio que `.gg-daterange__nav-btn` en `DateRangePicker.svelte`. */
	.gg-absence-range__nav-btn::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-absence-range__nav-btn:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-absence-range__nav-btn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-absence-range__summary {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}
</style>
