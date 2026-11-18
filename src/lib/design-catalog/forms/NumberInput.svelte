<script lang="ts">
	/**
	 * NumberInput — campo numérico con botones de incremento/decremento,
	 * a petición explícita (candidato #12 de la ronda de ampliación
	 * post-v0.13.0, ver docs/ROADMAP.md). No es un `Input type="number"`
	 * con las flechas nativas del navegador: esas flechas son minúsculas,
	 * inconsistentes entre navegadores y difíciles de usar con precisión
	 * táctil — aquí los botones +/- son del propio sistema de diseño
	 * (mismo tamaño objetivo que cualquier control interactivo del
	 * catálogo) y conviven con la entrada directa por teclado.
	 *
	 * Mismo patrón de tamaño/estado que el resto de Fase 2
	 * (`controlSizeSpec`/`stateBorderVar`/`stateRingVar` de `./types.js`),
	 * para que encaje sin sorpresas dentro de un `FormField`.
	 *
	 * El valor es SIEMPRE un número o `null` (campo vacío) — nunca una
	 * cadena a medio escribir expuesta al consumidor; el cuadro de texto
	 * interno sí usa texto, para poder escribir "-" o "1." en tránsito sin
	 * que `bind:value` lo rechace a mitad de tecleo.
	 */
	import { Icon } from "../icons/index.js";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props {
		value?: number | null;
		min?: number;
		max?: number;
		step?: number;
		size?: ControlSize;
		state?: ControlState;
		disabled?: boolean;
		readonly?: boolean;
		/** Nombre accesible de los botones +/- cuando no hay un `<FormLabel>` visible asociado al campo (p. ej. "Cantidad"). */
		label?: string;
		id?: string;
		name?: string;
		class?: string;
		style?: string;
	}

	let {
		value = $bindable(null),
		min,
		max,
		step = 1,
		size = "md",
		// Renombrado a `controlState` al desestructurar (no `state`): un
		// identificador local literalmente llamado `state` choca con la
		// rune `$state(...)` que este componente también necesita (Svelte
		// malinterpreta `$state` como "suscripción al store `state`"). La
		// prop pública sigue llamándose `state`, igual que en el resto de
		// Fase 2 — esto es solo un detalle interno.
		state: controlState = "default",
		disabled = false,
		readonly = false,
		label = "valor",
		id,
		name,
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	// Texto mostrado en el <input> — separado de `value` para poder
	// representar estados de tránsito ("-", "1.", "") que no son un
	// número válido todavía pero que el usuario necesita poder teclear.
	let text = $state(value == null ? "" : String(value));
	$effect(() => {
		const next = value == null ? "" : String(value);
		if (next !== text) text = next;
	});

	function clamp(n: number): number {
		let v = n;
		if (min != null && v < min) v = min;
		if (max != null && v > max) v = max;
		return v;
	}

	function commit(raw: string) {
		if (raw.trim() === "" || raw === "-") {
			value = null;
			return;
		}
		const n = Number(raw);
		if (Number.isNaN(n)) return;
		value = clamp(n);
	}

	function onInput(e: Event) {
		text = (e.target as HTMLInputElement).value;
	}

	function onBlur() {
		commit(text);
		text = value == null ? "" : String(value);
	}

	function step_(dir: 1 | -1) {
		if (disabled || readonly) return;
		const base = value ?? (min != null ? min : 0);
		value = clamp(Math.round((base + dir * step) * 1e10) / 1e10);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowUp") {
			e.preventDefault();
			step_(1);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			step_(-1);
		} else if (e.key === "Enter") {
			commit(text);
		}
	}

	let sz = $derived(controlSizeSpec(size));
	let atMin = $derived(value != null && min != null && value <= min);
	let atMax = $derived(value != null && max != null && value >= max);
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};` + `border-color:${stateBorderVar(controlState)};` + `--gg-number-ring:${stateRingVar(controlState)};` + styleProp
	);
	let fieldStyle = $derived(`padding:${sz.paddingY} ${sz.paddingX};` + `font-size:${sz.fontSize};` + `line-height:${sz.lineHeight};`);
	// Área táctil (docs/TOKENS.md, "--target-min"): a diferencia de
	// Checkbox/Radio/Switch/Calendar/Slider, aquí SÍ se agranda el botón
	// de verdad en vez de un área invisible — un botón +/- más grande no
	// desentona (a diferencia de una casilla o un pulgar de Slider
	// gigantes), así que no hace falta la técnica de pseudo-elemento. Solo
	// en "lg": en sm/md se deja `controlBoxSize` tal cual, mismo criterio
	// de no tocar los tamaños densos/de escritorio que Checkbox/Radio/
	// Switch.
	let stepBtnSize = $derived(size === "lg" ? "var(--target-min)" : sz.controlBoxSize);
</script>

<span class="gg-number-input {className}" class:gg-number-input--disabled={disabled} style={wrapperStyle}>
	<button
		type="button"
		class="gg-number-input__step"
		style={`width:${stepBtnSize};`}
		aria-label={`Disminuir ${label}`}
		tabindex="-1"
		disabled={disabled || readonly || atMin}
		onclick={() => step_(-1)}
	>
		<Icon
			name="minus"
			size={10}
			legacySvg={{
				viewBox: "0 0 12 12",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				body: '<path d="M2.5 6h7" />'
			}}
		/>
	</button>
	<input
		{id}
		{name}
		type="text"
		inputmode="decimal"
		role="spinbutton"
		class="gg-number-input__field"
		style={fieldStyle}
		value={text}
		{disabled}
		{readonly}
		aria-valuenow={value ?? undefined}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-invalid={controlState === "error" ? "true" : undefined}
		oninput={onInput}
		onblur={onBlur}
		onkeydown={onKeydown}
	/>
	<button
		type="button"
		class="gg-number-input__step"
		style={`width:${stepBtnSize};`}
		aria-label={`Aumentar ${label}`}
		tabindex="-1"
		disabled={disabled || readonly || atMax}
		onclick={() => step_(1)}
	>
		<Icon
			name="plus"
			size={10}
			legacySvg={{
				viewBox: "0 0 12 12",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				body: '<path d="M6 2.5v7M2.5 6h7" />'
			}}
		/>
	</button>
</span>

<style>
	.gg-number-input {
		box-sizing: border-box;
		display: inline-flex;
		align-items: stretch;
		width: 100%;
		max-width: var(--space-48);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-number-input:focus-within {
		border-color: var(--gg-number-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-number-ring) 30%, transparent);
	}

	.gg-number-input--disabled {
		opacity: 0.5;
	}

	.gg-number-input__field {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
		text-align: center;
	}

	.gg-number-input__field:disabled {
		cursor: not-allowed;
	}

	.gg-number-input__field:read-only {
		cursor: default;
	}

	.gg-number-input__step {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.gg-number-input__step:first-child {
		border-inline-end: 1px solid var(--border-subtle);
	}

	.gg-number-input__step:last-child {
		border-inline-start: 1px solid var(--border-subtle);
	}

	.gg-number-input__step:hover:not(:disabled) {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-number-input__step:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.gg-number-input__step:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-number-input {
			transition: none;
		}
	}
</style>
