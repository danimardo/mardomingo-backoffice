<script lang="ts">
	/**
	 * DateRangePicker — rango de fechas (candidato #4, la parte "rango"
	 * confirmada junto a `DatePicker` — ver ese fichero y `dateUtils.ts`
	 * para el contexto completo, mismo es-ES/lunes/dd-mm-aaaa). Dos
	 * campos de texto (inicio/fin, cada uno tecleable por separado) +
	 * UN calendario compartido para elegir ambos extremos sin cerrar y
	 * reabrir.
	 *
	 * Flujo de selección (el mismo que Google Flights/Airbnb/la mayoría
	 * de selectores de rango de referencia): clic en un día cuando no hay
	 * rango a medio elegir EMPIEZA uno nuevo (fija inicio, borra fin); el
	 * siguiente clic CIERRA el rango (fija fin — si el día es anterior al
	 * inicio, se intercambian para que inicio <= fin siempre). Mientras
	 * se elige el fin, pasar el ratón por encima de un día previsualiza
	 * el rango completo hasta ahí (`onHoverDate` de `Calendar`) — sin
	 * eso, el usuario no ve qué va a quedar seleccionado hasta soltar el
	 * clic, justo el tipo de feedback inmediato que pide §2 de
	 * `docs/PRINCIPIOS-UX.md`.
	 *
	 * `startDate`/`endDate`/`minDate`/`maxDate` son `string` "aaaa-mm-dd"
	 * (ISO 8601), NUNCA un `Date` — mismo cambio de API y mismo motivo
	 * que `DatePicker.svelte` (ver su comentario de cabecera): `Date`
	 * sigue siendo el tipo de cálculo interno, puenteado con
	 * `toISODate`/`fromISODate` de `dateUtils.ts`.
	 */
	import { Icon } from "../icons/index.js";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";
	import Calendar from "./Calendar.svelte";
	import { formatDateES, parseDateES, clampDate, isAfterDay, toISODate, fromISODate } from "./dateUtils.js";

	interface Props {
		startDate?: string | null;
		endDate?: string | null;
		minDate?: string | null;
		maxDate?: string | null;
		size?: ControlSize;
		state?: ControlState;
		disabled?: boolean;
		startLabel?: string;
		endLabel?: string;
		/** Marca un día del calendario desplegado como festivo — ver la nota de `Calendar.svelte`, se reenvía tal cual. */
		isHoliday?: ((d: Date) => boolean) | undefined;
		/** Igual que `isHoliday`, para "día sin servicio" — se reenvía tal cual a `Calendar`. */
		isNoService?: ((d: Date) => boolean) | undefined;
		/** Nombres de campo nativo, uno por extremo — dos `<input type="hidden">` con `value` ISO "aaaa-mm-dd" (inicio/fin), para que un `<form>` nativo los recoja sin JavaScript adicional. Un único `name` no tiene un formato de "rango" que todo backend espere igual, así que se piden explícitos — mismo criterio que `Slider`. */
		names?: [string, string];
		startId?: string;
		endId?: string;
		class?: string;
		style?: string;
	}

	let {
		startDate = $bindable(null),
		endDate = $bindable(null),
		minDate = null,
		maxDate = null,
		size = "md",
		state: controlState = "default",
		disabled = false,
		startLabel = "Fecha de inicio",
		endLabel = "Fecha de fin",
		isHoliday,
		isNoService,
		names,
		startId,
		endId,
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	const uid = $props.id();
	const calendarId = `${uid}-daterange-calendar`;

	let minD = $derived(fromISODate(minDate));
	let maxD = $derived(fromISODate(maxDate));
	let startD = $derived(fromISODate(startDate));
	let endD = $derived(fromISODate(endDate));

	let startText = $state(formatDateES(fromISODate(startDate)));
	let endText = $state(formatDateES(fromISODate(endDate)));
	let open = $state(false);
	let focused = $state(fromISODate(startDate) ?? new Date());
	let hoverDate: Date | null = $state(null);
	let container: HTMLDivElement | undefined = $state();
	let placement: "bottom" | "top" = $state("bottom");

	$effect(() => {
		if (!open) {
			startText = formatDateES(startD);
			endText = formatDateES(endD);
		}
	});

	let previewEnd = $derived(startD && !endD && hoverDate ? hoverDate : endD);
	let previewStart = $derived(
		startD && previewEnd && isAfterDay(startD, previewEnd) ? previewEnd : startD
	);
	let previewEndNormalized = $derived(
		startD && previewEnd && isAfterDay(startD, previewEnd) ? startD : previewEnd
	);

	function flipIfNeeded() {
		const panel = container?.querySelector<HTMLElement>(".gg-daterange__panel");
		if (!panel) return;
		const rect = panel.getBoundingClientRect();
		if (placement === "bottom" && rect.bottom > window.innerHeight) placement = "top";
		else if (placement === "top" && rect.top < 0) placement = "bottom";
	}

	function openPanel() {
		if (disabled || open) return;
		open = true;
		focused = clampDate(startD ?? endD ?? new Date(), minD, maxD);
		queueMicrotask(flipIfNeeded);
	}

	function closePanel() {
		open = false;
		hoverDate = null;
	}

	function selectDate(d: Date) {
		// Actualiza el texto de los campos aquí mismo, no solo por el
		// `$effect` de más arriba (que solo sincroniza al CERRAR el
		// panel) — el inicio del rango tiene que verse de inmediato en su
		// campo aunque el panel siga abierto esperando el fin (feedback
		// inmediato, §2 de docs/PRINCIPIOS-UX.md).
		if (!startD || endD) {
			startDate = toISODate(d);
			endDate = null;
			startText = formatDateES(d);
			endText = "";
		} else {
			if (isAfterDay(startD, d)) {
				endDate = startDate;
				startDate = toISODate(d);
			} else {
				endDate = toISODate(d);
			}
			startText = formatDateES(fromISODate(startDate));
			endText = formatDateES(fromISODate(endDate));
			closePanel();
		}
	}

	function onStartInput(e: Event) {
		startText = (e.target as HTMLInputElement).value;
		const parsed = parseDateES(startText);
		if (parsed) {
			startDate = toISODate(parsed);
			focused = clampDate(parsed, minD, maxD);
		}
	}

	function onEndInput(e: Event) {
		endText = (e.target as HTMLInputElement).value;
		const parsed = parseDateES(endText);
		if (parsed) endDate = toISODate(parsed);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && open) {
			e.preventDefault();
			closePanel();
			startText = formatDateES(startD);
			endText = formatDateES(endD);
		}
	}

	function onBlur() {
		setTimeout(() => {
			if (!container || !container.contains(document.activeElement)) {
				closePanel();
				startText = formatDateES(startD);
				endText = formatDateES(endD);
			}
		}, 0);
	}

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};border-color:${stateBorderVar(controlState)};--gg-daterange-ring:${stateRingVar(controlState)};` + styleProp
	);
	let fieldStyle = $derived(`padding:${sz.paddingY} ${sz.paddingX};font-size:${sz.fontSize};line-height:${sz.lineHeight};`);
</script>

<div bind:this={container} class="gg-daterange {className}">
	{#if names}
		<input type="hidden" name={names[0]} value={startDate ?? ""} {disabled} />
		<input type="hidden" name={names[1]} value={endDate ?? ""} {disabled} />
	{/if}
	<div class="gg-daterange__fields">
		<span class="gg-daterange__field-wrap" class:gg-daterange__field-wrap--disabled={disabled} style={wrapperStyle}>
			<input
				id={startId}
				type="text"
				inputmode="numeric"
				class="gg-daterange__field"
				style={fieldStyle}
				placeholder="dd/mm/aaaa"
				aria-label={startLabel}
				role="combobox"
				aria-expanded={open}
				aria-haspopup="grid"
				aria-controls={calendarId}
				aria-invalid={controlState === "error" ? "true" : undefined}
				autocomplete="off"
				{disabled}
				value={startText}
				oninput={onStartInput}
				onkeydown={onKeydown}
				onfocus={openPanel}
				onblur={onBlur}
			/>
		</span>
		<span class="gg-daterange__sep" aria-hidden="true">–</span>
		<span class="gg-daterange__field-wrap" class:gg-daterange__field-wrap--disabled={disabled} style={wrapperStyle}>
			<input
				id={endId}
				type="text"
				inputmode="numeric"
				class="gg-daterange__field"
				style={fieldStyle}
				placeholder="dd/mm/aaaa"
				aria-label={endLabel}
				role="combobox"
				aria-expanded={open}
				aria-haspopup="grid"
				aria-controls={calendarId}
				aria-invalid={controlState === "error" ? "true" : undefined}
				autocomplete="off"
				{disabled}
				value={endText}
				oninput={onEndInput}
				onkeydown={onKeydown}
				onfocus={openPanel}
				onblur={onBlur}
			/>
		</span>
		<button type="button" class="gg-daterange__trigger" tabindex="-1" {disabled} aria-label="Abrir calendario" onclick={() => (open ? closePanel() : openPanel())}>
			<Icon
				name="calendar"
				size="1.1em"
				legacySvg={{
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					body: '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" stroke-linecap="round" />'
				}}
			/>
		</button>
	</div>
	{#if open}
		<div class="gg-daterange__panel gg-daterange__panel--{placement} bc-glass bc-glass--elevated bc-anim-rise">
			<div class="gg-daterange__nav">
				<button type="button" class="gg-daterange__nav-btn" aria-label="Mes anterior" onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() - 1, 1))}>
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
				<span class="gg-daterange__nav-label" aria-hidden="true">{focused.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
				<button type="button" class="gg-daterange__nav-btn" aria-label="Mes siguiente" onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() + 1, 1))}>
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
				id={calendarId}
				bind:focused
				minDate={minD}
				maxDate={maxD}
				selectedStart={previewStart}
				selectedEnd={previewEndNormalized}
				onSelect={selectDate}
				onHoverDate={(d) => (hoverDate = d)}
				{isHoliday}
				{isNoService}
			/>
		</div>
	{/if}
</div>

<style>
	.gg-daterange {
		position: relative;
		width: 100%;
	}

	.gg-daterange__fields {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.gg-daterange__field-wrap {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-daterange__field-wrap:focus-within {
		border-color: var(--gg-daterange-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-daterange-ring) 30%, transparent);
	}

	.gg-daterange__field-wrap--disabled {
		opacity: 0.5;
	}

	.gg-daterange__field {
		width: 100%;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
	}

	.gg-daterange__field:disabled {
		cursor: not-allowed;
	}

	.gg-daterange__sep {
		flex-shrink: 0;
		padding-inline: var(--space-2);
		color: var(--text-muted);
	}

	.gg-daterange__trigger {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--space-6);
		height: var(--space-6);
		margin-inline-start: var(--space-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — ver la
	   nota equivalente en DatePicker.svelte (mismo criterio, sin condición
	   de tamaño). */
	.gg-daterange__trigger::before,
	.gg-daterange__nav-btn::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-daterange__trigger:hover:not(:disabled) {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-daterange__trigger:disabled {
		cursor: not-allowed;
	}

	.gg-daterange__panel {
		position: absolute;
		z-index: var(--z-dropdown);
		width: max-content;
		padding: var(--space-3);
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-daterange__panel--bottom {
		top: 100%;
		margin-top: var(--space-1);
	}

	.gg-daterange__panel--top {
		bottom: 100%;
		margin-bottom: var(--space-1);
	}

	.gg-daterange__nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.gg-daterange__nav-label {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-transform: capitalize;
	}

	.gg-daterange__nav-btn {
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

	.gg-daterange__nav-btn:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-daterange__nav-btn:focus-visible,
	.gg-daterange__trigger:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-daterange__field-wrap {
			transition: none;
		}
	}
</style>
