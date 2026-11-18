<script lang="ts">
	/**
	 * Slider — control de rango numérico (candidato #14 de la ronda de
	 * ampliación post-v0.13.0, ver docs/ROADMAP.md). Un único componente
	 * cubre tanto "un valor" (`value` es `number`) como "un rango de dos
	 * extremos" (`value` es `[number, number]`, p. ej. un filtro de
	 * precio mínimo/máximo) — mismo criterio de "una pieza, no dos casi
	 * iguales" que `Input`/`DataTable` en fases anteriores.
	 *
	 * `role="slider"` NATIVO de WAI-ARIA sobre un `<div>` enfocable — no
	 * existe `<input type="range">` con dos manejadores en HTML, así que
	 * el patrón "Slider (Multi-Thumb)" de WAI-ARIA APG es la única vía
	 * semánticamente correcta aquí. El arrastre usa Pointer Events (mismo
	 * patrón que el tirador de redimensión de `DataTable`): un único
	 * listener cubre ratón/táctil/lápiz. Teclado: flechas
	 * izquierda/derecha/arriba/abajo (paso `step`), Inicio/Fin (min/max),
	 * RePág/AvPág (paso × 10).
	 */
	type SliderValue = number | [number, number];

	interface Props {
		value?: SliderValue;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		/** Nombre accesible de cada manejador cuando no hay un `<FormLabel>` visible asociado (en modo rango, se usa como base: "Precio mínimo"/"Precio máximo" se generan a partir de esto si se pasan dos). */
		label?: string;
		/** Nombres accesibles explícitos para cada manejador en modo rango — si se omiten, se derivan de `label`. */
		labels?: [string, string];
		/** Formatea el valor para `aria-valuetext` y la etiqueta visible (p. ej. `(n) => "${n} €"`). Por defecto, el número tal cual. */
		formatValue?: (n: number) => string;
		/** Nombre de campo nativo en modo VALOR ÚNICO — añade un `<input type="hidden">` con el número, para que un `<form>` nativo lo recoja sin JS adicional. Ignorado en modo rango (usa `names`). */
		name?: string;
		/** Nombres de campo nativo en modo RANGO — dos `<input type="hidden">`, uno por extremo (mínimo/máximo). Un único `name` no tiene un formato de "rango" que todo backend espere igual, así que se piden explícitos — mismo criterio que `labels`. Ignorado en modo valor único (usa `name`). */
		names?: [string, string];
		class?: string;
		style?: string;
	}

	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		label = "valor",
		labels,
		formatValue = (n: number) => String(n),
		name,
		names,
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	let isRange = $derived(Array.isArray(value));
	let low = $derived(isRange ? (value as [number, number])[0] : (value as number));
	let high = $derived(isRange ? (value as [number, number])[1] : (value as number));

	let trackEl: HTMLDivElement | undefined = $state();

	function clamp(n: number): number {
		return Math.min(max, Math.max(min, n));
	}
	function snap(n: number): number {
		const stepped = Math.round((n - min) / step) * step + min;
		return clamp(Math.round(stepped * 1e10) / 1e10);
	}
	function percent(n: number): number {
		return max === min ? 0 : ((n - min) / (max - min)) * 100;
	}

	function setLow(n: number) {
		// El límite "no cruzar al manejador superior" SOLO tiene sentido en
		// modo rango — en modo valor único `high` es un alias degenerado
		// del propio `low` (ver el `$derived` de arriba), así que aplicar
		// el mismo `Math.min(_, high)` ahí atascaba el valor para siempre
		// en su cifra inicial (nunca podía subir, `high` igual a `low`
		// antes de cada actualización). Bug real, no solo de la prueba —
		// encontrado por la comprobación de Flecha-derecha en
		// `verify-styleguide.mjs`.
		const v = isRange ? Math.min(snap(n), high) : snap(n);
		if (isRange) value = [v, high];
		else value = v;
	}
	function setHigh(n: number) {
		const v = Math.max(snap(n), low);
		value = [low, v];
	}

	function valueFromClientX(clientX: number): number {
		if (!trackEl) return min;
		const rect = trackEl.getBoundingClientRect();
		const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
		return min + ratio * (max - min);
	}

	function startDrag(event: PointerEvent, thumb: "low" | "high") {
		if (disabled) return;
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture(event.pointerId);
		handle.focus();

		function onMove(e: PointerEvent) {
			const n = valueFromClientX(e.clientX);
			if (thumb === "low") setLow(n);
			else setHigh(n);
		}
		function onUp(e: PointerEvent) {
			handle.releasePointerCapture(e.pointerId);
			handle.removeEventListener("pointermove", onMove);
			handle.removeEventListener("pointerup", onUp);
			handle.removeEventListener("pointercancel", onUp);
		}
		handle.addEventListener("pointermove", onMove);
		handle.addEventListener("pointerup", onUp);
		handle.addEventListener("pointercancel", onUp);
	}

	function onTrackPointerDown(event: PointerEvent) {
		if (disabled || (event.target as HTMLElement).dataset.thumb) return;
		const n = valueFromClientX(event.clientX);
		if (!isRange) {
			setLow(n);
			return;
		}
		// En modo rango, mueve el manejador más cercano al punto pulsado.
		if (Math.abs(n - low) <= Math.abs(n - high)) setLow(n);
		else setHigh(n);
	}

	function onKeydown(event: KeyboardEvent, thumb: "low" | "high") {
		if (disabled) return;
		const big = step * 10;
		const current = thumb === "low" ? low : high;
		const apply = thumb === "low" ? setLow : setHigh;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				event.preventDefault();
				apply(current + step);
				break;
			case "ArrowLeft":
			case "ArrowDown":
				event.preventDefault();
				apply(current - step);
				break;
			case "PageUp":
				event.preventDefault();
				apply(current + big);
				break;
			case "PageDown":
				event.preventDefault();
				apply(current - big);
				break;
			case "Home":
				event.preventDefault();
				apply(min);
				break;
			case "End":
				event.preventDefault();
				apply(max);
				break;
		}
	}

	let lowLabel = $derived(labels ? labels[0] : isRange ? `${label} (mínimo)` : label);
	let highLabel = $derived(labels ? labels[1] : `${label} (máximo)`);
</script>

<div class="gg-slider {className}" class:gg-slider--disabled={disabled} style={styleProp}>
	{#if !isRange && name}
		<input type="hidden" {name} value={String(low)} {disabled} />
	{:else if isRange && names}
		<input type="hidden" name={names[0]} value={String(low)} {disabled} />
		<input type="hidden" name={names[1]} value={String(high)} {disabled} />
	{/if}
	<!--
		role="presentation": la pista en sí no transmite información propia
		(es solo el área de arrastre/clic) — toda la semántica de valor
		vive en los `role="slider"` de los manejadores de abajo. El clic
		directo sobre la pista es un atajo de ratón; el teclado ya tiene
		acceso completo (flechas/Inicio/Fin/RePág/AvPág) a través de cada
		manejador, así que no hace falta un segundo mecanismo accesible
		aquí.
	-->
	<div bind:this={trackEl} class="gg-slider__track" role="presentation" onpointerdown={onTrackPointerDown}>
		<div
			class="gg-slider__fill"
			style={isRange
				? `left:${percent(low)}%; width:${percent(high) - percent(low)}%;`
				: `left:0%; width:${percent(low)}%;`}
		></div>
		<div
			class="gg-slider__thumb"
			data-thumb="low"
			role="slider"
			tabindex={disabled ? -1 : 0}
			aria-label={lowLabel}
			aria-valuemin={min}
			aria-valuemax={isRange ? high : max}
			aria-valuenow={low}
			aria-valuetext={formatValue(low)}
			aria-disabled={disabled}
			style={`left:${percent(low)}%;`}
			onpointerdown={(e) => startDrag(e, "low")}
			onkeydown={(e) => onKeydown(e, "low")}
		></div>
		{#if isRange}
			<div
				class="gg-slider__thumb"
				data-thumb="high"
				role="slider"
				tabindex={disabled ? -1 : 0}
				aria-label={highLabel}
				aria-valuemin={low}
				aria-valuemax={max}
				aria-valuenow={high}
				aria-valuetext={formatValue(high)}
				aria-disabled={disabled}
				style={`left:${percent(high)}%;`}
				onpointerdown={(e) => startDrag(e, "high")}
				onkeydown={(e) => onKeydown(e, "high")}
			></div>
		{/if}
	</div>
</div>

<style>
	.gg-slider {
		width: 100%;
		padding-block: var(--space-2);
	}

	.gg-slider--disabled {
		opacity: 0.5;
	}

	.gg-slider__track {
		position: relative;
		height: var(--space-1);
		border-radius: var(--radius-full);
		background: var(--border-subtle);
		cursor: pointer;
		touch-action: none;
	}

	.gg-slider--disabled .gg-slider__track {
		cursor: not-allowed;
	}

	.gg-slider__fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: var(--radius-full);
		background: var(--interactive-primary);
	}

	.gg-slider__thumb {
		position: absolute;
		top: 50%;
		width: var(--space-4);
		height: var(--space-4);
		border-radius: var(--radius-full);
		background: var(--surface);
		border: 2px solid var(--interactive-primary);
		transform: translate(-50%, -50%);
		cursor: grab;
		touch-action: none;
	}

	/* Área de impacto táctil (docs/TOKENS.md, "--target-min") — sin
	   condición de tamaño (Slider no tiene prop `size` y no suele
	   empaquetarse denso, a diferencia de un checkbox en una fila de
	   tabla). Pseudo-elemento invisible centrado sobre el manejador real,
	   que agrandarlo de verdad desentonaría visualmente en un control tan
	   fino — mismo criterio que Checkbox/Radio/Switch/Calendar, no el de
	   NumberInput. */
	.gg-slider__thumb::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-slider__thumb:active {
		cursor: grabbing;
	}

	.gg-slider__thumb:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-slider--disabled .gg-slider__thumb {
		cursor: not-allowed;
	}
</style>
