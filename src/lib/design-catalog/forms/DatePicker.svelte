<script lang="ts">
	/**
	 * DatePicker — fecha única, campo de texto (dd/mm/aaaa, tecleable
	 * directamente) + calendario desplegable real (candidato #4 de la
	 * ronda de ampliación post-v0.13.0 — el usuario pidió explícitamente
	 * "un picker de calendario", no solo un campo de texto con máscara).
	 * es-ES, semana empezando en lunes — ver `dateUtils.ts`.
	 *
	 * `value`/`minDate`/`maxDate` son `string` "aaaa-mm-dd" (ISO 8601),
	 * NUNCA un `Date` — cambio de API de la ronda de ampliación UX
	 * post-v0.14.0, a petición de una constitución de proyecto consumidor
	 * que prohíbe `Date` en cualquier fecha de calendario de su propio
	 * código (`Temporal.PlainDate` en código, "aaaa-mm-dd" en tránsito).
	 * `Date` sigue siendo el tipo de cálculo INTERNO (aritmética de mes/
	 * semana vía `Calendar`), pero ya no se expone en la API pública de
	 * este componente — ver `toISODate`/`fromISODate` en `dateUtils.ts`
	 * para el puente entre ambos mundos, usado en todo este fichero. El
	 * texto del campo (dd/mm/aaaa) puede estar a medio escribir sin que
	 * eso toque `value` hasta que se pueda analizar como fecha válida
	 * (`parseDateES`) o hasta que se elija un día en el calendario.
	 *
	 * Popover: mismo método de posicionamiento ya probado en
	 * `DropdownMenu`/`Combobox` (relative+absolute, voltea si no cabe) —
	 * ninguna pieza nueva de posicionamiento.
	 */
	import { tick, untrack } from "svelte";
	import { Icon } from "../icons/index.js";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";
	import Calendar from "./Calendar.svelte";
	import { formatDateES, parseDateES, clampDate, toISODate, fromISODate } from "./dateUtils.js";

	interface Props {
		value?: string | null;
		minDate?: string | null;
		maxDate?: string | null;
		placeholder?: string;
		size?: ControlSize;
		state?: ControlState;
		disabled?: boolean;
		label?: string;
		/** Marca un día del calendario desplegado como festivo — ver la nota de `Calendar.svelte`, se reenvía tal cual. */
		isHoliday?: ((d: Date) => boolean) | undefined;
		/** Igual que `isHoliday`, para "día sin servicio" — se reenvía tal cual a `Calendar`. */
		isNoService?: ((d: Date) => boolean) | undefined;
		/** Nombre de campo nativo — añade un `<input type="hidden">` con `value` (ISO "aaaa-mm-dd"), para que un `<form>` nativo lo recoja sin JavaScript adicional (mismo patrón que `Slider`/`Combobox`/`MultiSelect`). */
		name?: string;
		id?: string;
		"aria-describedby"?: string | undefined;
		class?: string;
		style?: string;
	}

	let {
		value = $bindable(null),
		minDate = null,
		maxDate = null,
		placeholder = "dd/mm/aaaa",
		size = "md",
		state: controlState = "default",
		disabled = false,
		label,
		isHoliday,
		isNoService,
		name,
		id,
		"aria-describedby": describedBy,
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	const uid = $props.id();
	const calendarId = `${uid}-datepicker-calendar`;

	let minD = $derived(fromISODate(minDate));
	let maxD = $derived(fromISODate(maxDate));
	let valueD = $derived(fromISODate(value));

	let text = $state(formatDateES(fromISODate(value)));
	let open = $state(false);
	// `untrack`: solo la foto INICIAL de minDate/maxDate/value — igual
	// que `effectivePlacement` en DropdownMenu, `openPanel()` ya
	// recalcula esto en cada apertura con los valores vivos.
	let focused = $state(untrack(() => clampDate(fromISODate(value) ?? new Date(), fromISODate(minDate), fromISODate(maxDate))));
	let container: HTMLDivElement | undefined = $state();
	let fieldWrap: HTMLSpanElement | undefined = $state();
	// v1.8.0: el panel es `position: fixed` y se coloca desde el campo. Con `absolute` contaba para el scroll de un
	// ancestro con `overflow` (p. ej. el cuerpo de un `Dialog` corto) y quedaba recortado con una barra interior.
	let panelStyle = $state("");

	$effect(() => {
		if (!open) text = formatDateES(valueD);
	});

	// Separación fija en px de pantalla entre el campo y el panel, como la del `tooltip` (no es un `--space-*`).
	const PANEL_GAP = 4;

	/** Coloca el panel bajo el campo; lo voltea encima si no cabe debajo y lo mantiene dentro de la ventana. */
	function placePanel() {
		const panel = container?.querySelector<HTMLElement>(".gg-datepicker__panel");
		if (!panel || !fieldWrap) return;
		const field = fieldWrap.getBoundingClientRect();
		let top = field.bottom + PANEL_GAP;
		if (top + panel.offsetHeight > window.innerHeight && field.top - PANEL_GAP - panel.offsetHeight >= 0) {
			top = field.top - PANEL_GAP - panel.offsetHeight;
		}
		const left = Math.max(PANEL_GAP, Math.min(field.left, window.innerWidth - panel.offsetWidth - PANEL_GAP));
		panelStyle = `top:${top}px;left:${left}px;`;
	}

	// Mientras está abierto, sigue al campo si la ventana o cualquier ancestro con scroll se mueve.
	$effect(() => {
		if (!open) return;
		window.addEventListener("resize", placePanel);
		window.addEventListener("scroll", placePanel, true);
		return () => {
			window.removeEventListener("resize", placePanel);
			window.removeEventListener("scroll", placePanel, true);
		};
	});

	function openPanel() {
		if (disabled || open) return;
		open = true;
		focused = clampDate(valueD ?? new Date(), minD, maxD);
		// Oculto hasta tener sitio: sin esto se vería un instante en la esquina.
		panelStyle = "top:0;left:0;visibility:hidden;";
		void tick().then(placePanel);
	}

	function closePanel() {
		open = false;
	}

	function selectDate(d: Date) {
		value = toISODate(d);
		text = formatDateES(d);
		closePanel();
	}

	function onInput(e: Event) {
		text = (e.target as HTMLInputElement).value;
		const parsed = parseDateES(text);
		if (parsed) {
			value = toISODate(parsed);
			focused = clampDate(parsed, minD, maxD);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && open) {
			e.preventDefault();
			closePanel();
			text = formatDateES(valueD);
		} else if (e.key === "ArrowDown" && !open) {
			e.preventDefault();
			openPanel();
		}
	}

	function onBlur() {
		setTimeout(() => {
			if (!container || !container.contains(document.activeElement)) {
				closePanel();
				text = formatDateES(valueD);
			}
		}, 0);
	}

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};border-color:${stateBorderVar(controlState)};--gg-datepicker-ring:${stateRingVar(controlState)};` + styleProp
	);
	let fieldStyle = $derived(`padding:${sz.paddingY} ${sz.paddingX};font-size:${sz.fontSize};line-height:${sz.lineHeight};`);
</script>

<div bind:this={container} class="gg-datepicker {className}">
	{#if name}
		<input type="hidden" {name} value={value ?? ""} {disabled} />
	{/if}
	<span bind:this={fieldWrap} class="gg-datepicker__field-wrap" class:gg-datepicker__field-wrap--disabled={disabled} style={wrapperStyle}>
		<input
			{id}
			type="text"
			inputmode="numeric"
			class="gg-datepicker__field"
			style={fieldStyle}
			role="combobox"
			aria-expanded={open}
			aria-controls={calendarId}
			aria-haspopup="grid"
			aria-label={label}
			aria-describedby={describedBy}
			aria-invalid={controlState === "error" ? "true" : undefined}
			autocomplete="off"
			{placeholder}
			{disabled}
			value={text}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={openPanel}
			onblur={onBlur}
		/>
		<button type="button" class="gg-datepicker__trigger" tabindex="-1" {disabled} aria-label="Abrir calendario" onclick={() => (open ? closePanel() : openPanel())}>
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
	</span>
	{#if open}
		<div class="gg-datepicker__panel bc-glass bc-glass--elevated bc-anim-rise" style={panelStyle}>
			<div class="gg-datepicker__nav">
				<button type="button" class="gg-datepicker__nav-btn" aria-label="Mes anterior" onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() - 1, 1))}>
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
				<span class="gg-datepicker__nav-label" aria-hidden="true">{focused.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
				<button type="button" class="gg-datepicker__nav-btn" aria-label="Mes siguiente" onclick={() => (focused = new Date(focused.getFullYear(), focused.getMonth() + 1, 1))}>
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
				selectedStart={valueD}
				selectedEnd={valueD}
				onSelect={selectDate}
				{isHoliday}
				{isNoService}
			/>
		</div>
	{/if}
</div>

<style>
	.gg-datepicker {
		position: relative;
		width: 100%;
	}

	.gg-datepicker__field-wrap {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-datepicker__field-wrap:focus-within {
		border-color: var(--gg-datepicker-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-datepicker-ring) 30%, transparent);
	}

	.gg-datepicker__field-wrap--disabled {
		opacity: 0.5;
	}

	.gg-datepicker__field {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
	}

	.gg-datepicker__field:disabled {
		cursor: not-allowed;
	}

	.gg-datepicker__trigger {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--space-6);
		height: var(--space-6);
		margin-inline-end: var(--space-1);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — mismo
	   criterio que Calendar.svelte (pseudo-elemento invisible, sin
	   condición de tamaño: agrandar el icono de verdad desentonaría
	   dentro del campo). */
	.gg-datepicker__trigger::before,
	.gg-datepicker__nav-btn::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-datepicker__trigger:hover:not(:disabled) {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-datepicker__trigger:disabled {
		cursor: not-allowed;
	}

	.gg-datepicker__panel {
		position: fixed;
		z-index: var(--z-dropdown);
		width: max-content;
		padding: var(--space-3);
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-datepicker__nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.gg-datepicker__nav-label {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-transform: capitalize;
	}

	.gg-datepicker__nav-btn {
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

	.gg-datepicker__nav-btn:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-datepicker__nav-btn:focus-visible,
	.gg-datepicker__trigger:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-datepicker__field-wrap {
			transition: none;
		}
	}
</style>
