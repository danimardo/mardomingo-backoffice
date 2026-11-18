<script lang="ts">
	/**
	 * Calendar — cuadrícula de mes reutilizada por `DatePicker` y
	 * `DateRangePicker` (pieza interna, no se exporta en `forms/index.ts`
	 * — mismo criterio que el chip de `FilterBar`: existe porque dos
	 * piezas hermanas la necesitan igual, no como API pública propia
	 * todavía).
	 *
	 * `<table>` NATIVA (`<thead>` con los días de la semana, `<tbody>`
	 * con las semanas) en vez de `role="grid"` pintado a mano — mismo
	 * criterio que `DataTable` en Fase 4 ("semántica nativa antes que
	 * ARIA a mano"), con el patrón WAI-ARIA "Date Picker Dialog" encima
	 * (roving tabindex en los botones de día: un único `tabindex="0"`,
	 * el resto `-1`, el foco real se mueve con las flechas).
	 *
	 * Teclado completo: flechas mueven un día/una semana; Inicio/Fin van
	 * al lunes/domingo de la semana enfocada; RePág/AvPág cambian de mes;
	 * Mayús+RePág/AvPág cambian de año (mismo patrón que la mayoría de
	 * calendarios de referencia — Google Calendar, Outlook). Intro/
	 * Espacio seleccionan el día enfocado.
	 */
	import { getMonthMatrix, isSameDay, addMonths, addDays, isBeforeDay, isAfterDay, MONTH_NAMES_ES, WEEKDAY_LABELS_ES, WEEKDAY_NAMES_ES } from "./dateUtils.js";

	interface Props {
		focused: Date;
		selectedStart?: Date | null;
		selectedEnd?: Date | null;
		minDate?: Date | null;
		maxDate?: Date | null;
		onSelect: (d: Date) => void;
		onHoverDate?: (d: Date | null) => void;
		/**
		 * Marca un día como festivo (sociedad) — mecanismo GENÉRICO de
		 * Fase 1 (ronda de ampliación UX post-v0.14.0) para que
		 * `DatePicker`/`DateRangePicker`, y más adelante las vistas de
		 * planificación de Fase 3 (`AbsenceCalendarMonth`/`Year`/
		 * `Employee`), puedan señalar días especiales. Añade la clase
		 * modificadora `.gg-calendar__day--holiday`, con el tratamiento
		 * visual definitivo de Fase 2 (`--absence-holiday-bg` de
		 * tokens.css, verificado ≥3:1 contra --surface en ambos temas —
		 * ver Historias.md §4.4).
		 */
		isHoliday?: ((d: Date) => boolean) | undefined;
		/** Igual que `isHoliday`, para "día sin servicio" (excepción de departamento) — clase `.gg-calendar__day--no-service`. */
		isNoService?: ((d: Date) => boolean) | undefined;
		id?: string;
		class?: string;
	}

	let {
		focused = $bindable(),
		selectedStart = null,
		selectedEnd = null,
		minDate = null,
		maxDate = null,
		onSelect,
		onHoverDate,
		isHoliday,
		isNoService,
		id,
		class: className = ""
	}: Props = $props();

	let gridEl: HTMLTableSectionElement | undefined = $state();

	let weeks = $derived.by(() => {
		const matrix = getMonthMatrix(focused.getFullYear(), focused.getMonth());
		const out = [];
		for (let i = 0; i < matrix.length; i += 7) out.push(matrix.slice(i, i + 7));
		return out;
	});

	function isDisabled(d: Date): boolean {
		return (!!minDate && isBeforeDay(d, minDate)) || (!!maxDate && isAfterDay(d, maxDate));
	}

	function dayStatus(d: Date): "start" | "end" | "in-range" | "none" {
		if (selectedStart && isSameDay(d, selectedStart)) return "start";
		if (selectedEnd && isSameDay(d, selectedEnd)) return "end";
		if (selectedStart && selectedEnd && !isBeforeDay(d, selectedStart) && !isAfterDay(d, selectedEnd)) return "in-range";
		return "none";
	}

	function focusCell(d: Date) {
		focused = d;
		queueMicrotask(() => {
			gridEl?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
		});
	}

	function onKeydown(e: KeyboardEvent) {
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
		} else if (e.key === "PageUp") {
			e.preventDefault();
			focusCell(e.shiftKey ? new Date(focused.getFullYear() - 1, focused.getMonth(), focused.getDate()) : addMonths(focused, -1));
		} else if (e.key === "PageDown") {
			e.preventDefault();
			focusCell(e.shiftKey ? new Date(focused.getFullYear() + 1, focused.getMonth(), focused.getDate()) : addMonths(focused, 1));
		} else if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (!isDisabled(focused)) onSelect(focused);
		}
	}
</script>

<table {id} class="gg-calendar {className}" role="grid" aria-label={`${MONTH_NAMES_ES[focused.getMonth()]} de ${focused.getFullYear()}`}>
	<thead>
		<tr>
			{#each WEEKDAY_LABELS_ES as label, i (label)}
				<th scope="col" abbr={WEEKDAY_NAMES_ES[i]}>{label}</th>
			{/each}
		</tr>
	</thead>
	<!--
		svelte-ignore a11y_no_noninteractive_element_interactions -- patrón
		WAI-ARIA "Date Picker Dialog": el `onkeydown` del contenedor es
		DELEGACIÓN de evento para el roving tabindex de la cuadrícula (un
		único botón de día con tabindex="0" a la vez) — el manejador real
		de teclado vive aquí a propósito, no en cada botón suelto, mismo
		motivo por el que `DropdownMenu`/`Menu` delegan Escape/flechas en
		su contenedor en vez de en cada item.
	-->
	<tbody bind:this={gridEl} onkeydown={onKeydown}>
		{#each weeks as week, wi (wi)}
			<tr>
				{#each week as day (day.date.getTime())}
					{@const status = dayStatus(day.date)}
					{@const isFocused = isSameDay(day.date, focused)}
					{@const disabled = isDisabled(day.date)}
					<td role="gridcell" aria-selected={status !== "none"}>
						<button
							type="button"
							class="gg-calendar__day gg-calendar__day--{status}"
							class:gg-calendar__day--outside={day.outside}
							class:gg-calendar__day--holiday={isHoliday?.(day.date) ?? false}
							class:gg-calendar__day--no-service={isNoService?.(day.date) ?? false}
							tabindex={isFocused ? 0 : -1}
							{disabled}
							aria-current={isSameDay(day.date, new Date()) ? "date" : undefined}
							onclick={() => {
								focused = day.date;
								onSelect(day.date);
							}}
							onmouseenter={() => onHoverDate?.(day.date)}
							onmouseleave={() => onHoverDate?.(null)}
						>
							{day.date.getDate()}
						</button>
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.gg-calendar {
		border-collapse: collapse;
		width: 100%;
	}

	.gg-calendar th {
		padding-block-end: var(--space-2);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
	}

	.gg-calendar td {
		padding: 0;
		text-align: center;
	}

	.gg-calendar__day {
		box-sizing: border-box;
		position: relative;
		width: var(--space-8);
		height: var(--space-8);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — sin
	   condición de tamaño (Calendar no tiene prop `size`; esta misma
	   cuadrícula es la base de las vistas de planificación de Fase 3).
	   Pseudo-elemento invisible centrado sobre el círculo de día real, que
	   agrandarlo de verdad apretaría la cuadrícula de 7 columnas —
	   `overflow` no recortado de `<td>`/`<table>` deja que la zona
	   invisible se solape un poco con la celda vecina, igual que el
	   manejador de Slider. */
	.gg-calendar__day::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-calendar__day:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.gg-calendar__day:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-calendar__day--outside {
		color: var(--text-disabled);
	}

	.gg-calendar__day:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-calendar__day--start,
	.gg-calendar__day--end {
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	.gg-calendar__day--in-range {
		background: color-mix(in srgb, var(--interactive-primary) 16%, var(--surface));
		border-radius: var(--radius-sm);
	}

	/* Marcado de días (festivo/sin servicio) — tokens definitivos de Fase 2
	   (`--absence-holiday-bg`/`--absence-no-service-bg`, ver tokens.css,
	   verificados ≥3:1 contra --surface en ambos temas), sustituyendo el
	   tratamiento provisional de Fase 1 (tinte plano de --status-danger
	   sobre fondo transparente) sin tocar esta API — exactamente como
	   anticipaba el comentario de Fase 1. Nunca solo color (WCAG 1.4.1):
	   festivo usa tinte de fondo, sin servicio usa fondo + borde
	   discontinuo — dos pistas visuales distintas incluso en escala de
	   grises. */
	.gg-calendar__day--holiday {
		background: var(--absence-holiday-bg);
	}

	.gg-calendar__day--no-service {
		background: var(--absence-no-service-bg);
		border: 1.5px dashed var(--text-muted);
	}

	/* El estado de selección (fondo sólido) manda sobre el tinte de
	   festivo — si no, un día festivo seleccionado perdería el feedback
	   de selección, más importante en ese momento que la marca de fondo. */
	.gg-calendar__day--holiday.gg-calendar__day--start,
	.gg-calendar__day--holiday.gg-calendar__day--end {
		background: var(--surface-button-primary);
	}
</style>
