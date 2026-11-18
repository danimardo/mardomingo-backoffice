<script lang="ts">
	/**
	 * Stepper — indicador de progreso por pasos para un asistente/wizard
	 * (candidato #10 de la ronda de ampliación post-v0.13.0, ver
	 * docs/ROADMAP.md). Sin estado propio, igual que `FilterBar`: el
	 * consumidor decide cuál es `current` (normalmente tras validar el
	 * paso anterior) — `Stepper` no avanza nada por sí solo, solo pinta
	 * el estado y, si se pasa `onStepClick`, permite volver a un paso YA
	 * completado (nunca saltar a uno futuro sin completar — por eso solo
	 * los pasos `completed` son clicables, nunca los `upcoming`).
	 *
	 * No hay un patrón WAI-ARIA dedicado para "stepper" — se usa la
	 * misma solución que el resto de catálogos de referencia: una lista
	 * ordenada (`<ol>`, orden ya es semántica de lista) con
	 * `aria-current="step"` en el paso activo (el valor de `aria-current`
	 * pensado exactamente para esto, WAI-ARIA 1.2).
	 *
	 * Reutiliza pares de contraste ya verificados, no inventa ninguno:
	 * círculo relleno (paso completado) = mismo par que un botón
	 * primario (`--surface-button-primary` + `--color-on-primary`, el
	 * mismo que ya usa la página activa de `Pagination`); texto/borde de
	 * error = `--status-danger` como TEXTO (verificado desde Fase 1,
	 * igual que `FormError`); paso activo = `--text-interactive` (mismo
	 * token que la pestaña activa de `Tabs`).
	 */
	import { Icon } from "../icons/index.js";

	export interface StepperStep {
		value: string;
		label: string;
		description?: string;
		/** `"skipped"` (v1.12.0): paso omitido — borde discontinuo y línea pendiente; en vertical se puede retomar. */
		state?: "error" | "skipped";
		/** v1.12.0: texto de estado bajo la etiqueta («Completado», «Omitido», «Ahora»…); se suma al nombre accesible. */
		statusLabel?: string;
	}

	interface Props {
		steps: StepperStep[];
		current: string;
		orientation?: "horizontal" | "vertical";
		onStepClick?: (value: string) => void;
		class?: string;
	}

	let { steps, current, orientation = "horizontal", onStepClick, class: className = "" }: Props = $props();

	function statusOf(step: StepperStep, index: number, currentIndex: number): "completed" | "current" | "upcoming" | "error" | "skipped" {
		if (step.state === "error") return "error";
		if (step.state === "skipped") return "skipped";
		if (index < currentIndex) return "completed";
		if (index === currentIndex) return "current";
		return "upcoming";
	}

	let currentIndex = $derived(steps.findIndex((s) => s.value === current));
</script>

<ol class="gg-stepper gg-stepper--{orientation} {className}">
	{#each steps as step, i (step.value)}
		{@const status = statusOf(step, i, currentIndex)}
		{@const clickable = !!onStepClick && (status === "completed" || (status === "skipped" && orientation === "vertical"))}
		<li class="gg-stepper__item">
			<div class="gg-stepper__marker-col">
				{#if clickable}
					<button
						type="button"
						class="gg-stepper__circle gg-stepper__circle--{status}"
						onclick={() => onStepClick?.(step.value)}
						aria-label={`Volver a «${step.label}»${step.statusLabel ? ` (${step.statusLabel})` : ""}`}
					>
						{#if status === "completed"}
							<Icon
								name="check"
								size="0.75em"
								tone="on-primary"
								legacySvg={{
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									body: '<path d="M3 8.5l3.2 3.2L13 4.5" />'
								}}
							/>
						{:else}
							{i + 1}
						{/if}
					</button>
				{:else}
					<span class="gg-stepper__circle gg-stepper__circle--{status}" aria-current={status === "current" ? "step" : undefined}>
						{#if status === "completed"}
							<Icon
								name="check"
								size="0.75em"
								tone="on-primary"
								legacySvg={{
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "2",
									body: '<path d="M3 8.5l3.2 3.2L13 4.5" />'
								}}
							/>
						{:else if status === "error"}
							<span aria-hidden="true">!</span>
						{:else}
							{i + 1}
						{/if}
					</span>
				{/if}
				{#if i < steps.length - 1}
					<span class="gg-stepper__line gg-stepper__line--{status === 'completed' ? 'done' : 'pending'}" aria-hidden="true"></span>
				{/if}
			</div>
			<div class="gg-stepper__text">
				<span class="gg-stepper__label gg-stepper__label--{status}">{step.label}</span>
				{#if step.statusLabel}
					<span class="gg-stepper__status">{step.statusLabel}</span>
				{/if}
				{#if step.description}
					<span class="gg-stepper__description">{step.description}</span>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<style>
	.gg-stepper {
		display: flex;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.gg-stepper--horizontal {
		flex-direction: row;
		align-items: flex-start;
	}

	.gg-stepper--vertical {
		flex-direction: column;
	}

	.gg-stepper__item {
		display: flex;
		flex: 1;
	}

	.gg-stepper--horizontal .gg-stepper__item {
		flex-direction: column;
	}

	.gg-stepper--vertical .gg-stepper__item {
		flex-direction: row;
		gap: var(--space-3);
	}

	.gg-stepper--horizontal .gg-stepper__item:last-child {
		flex: none;
	}

	.gg-stepper__marker-col {
		display: flex;
		align-items: center;
	}

	.gg-stepper--horizontal .gg-stepper__marker-col {
		flex-direction: row;
		width: 100%;
	}

	.gg-stepper--vertical .gg-stepper__marker-col {
		flex-direction: column;
		align-items: center;
	}

	.gg-stepper__circle {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--space-6);
		height: var(--space-6);
		padding: 0;
		text-align: center;
		border-radius: var(--radius-full);
		border: 2px solid var(--border);
		background: var(--surface);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		color: var(--text-muted);
		cursor: default;
	}

	button.gg-stepper__circle {
		cursor: pointer;
	}

	button.gg-stepper__circle:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-stepper__circle--current {
		/* v1.9.0 — el paso actual («dónde estás») lleva el anillo naranja
		   (--indicator-accent, ≥3:1) y su número sigue en --text-interactive;
		   además `aria-current="step"`. Los completados siguen en azul. */
		border-color: var(--indicator-accent);
		color: var(--text-interactive);
	}

	.gg-stepper__circle--completed {
		border-color: var(--surface-button-primary);
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	.gg-stepper__circle--skipped {
		border-style: dashed;
		border-color: var(--border-strong);
		color: var(--text-muted);
	}

	.gg-stepper__circle--error {
		border-color: var(--status-danger);
		color: var(--status-danger);
	}

	.gg-stepper__line {
		flex: 1;
		background: var(--border);
	}

	.gg-stepper--horizontal .gg-stepper__line {
		height: 2px;
		margin-inline: var(--space-2);
	}

	.gg-stepper--vertical .gg-stepper__line {
		width: 2px;
		min-height: var(--space-6);
		margin-block: var(--space-1);
	}

	.gg-stepper__line--done {
		background: var(--surface-button-primary);
	}

	.gg-stepper__text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-stepper--horizontal .gg-stepper__text {
		margin-top: var(--space-2);
	}

	.gg-stepper--vertical .gg-stepper__text {
		padding-block-end: var(--space-4);
	}

	.gg-stepper__label {
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		color: var(--text-muted);
	}

	.gg-stepper__label--current,
	.gg-stepper__label--completed {
		color: var(--text-primary);
	}

	.gg-stepper__label--error {
		color: var(--text-danger);
	}

	.gg-stepper__status {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}

	.gg-stepper__description {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}
</style>
