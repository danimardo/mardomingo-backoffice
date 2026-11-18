<script lang="ts">
	/**
	 * CircularProgress (ampliación 2, §24 — dejado fuera en Fase 5 junto
	 * con `ProgressBar` por ser progreso DETERMINADO, ver
	 * `docs/ROADMAP.md`; ahora con `ProgressBar` ya construida en la
	 * ampliación 1, esta es su forma circular, no una pieza con
	 * vocabulario distinto) — el mismo `role="progressbar"` +
	 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, los mismos tonos ya
	 * verificados (ver `docs/TOKENS.md`), la misma convención `value`
	 * como fracción 0-1.
	 *
	 * Geometría SVG con un único `viewBox="0 0 100 100"` fijo para los
	 * tres tamaños — el tamaño RENDERIZADO lo decide el contenedor CSS
	 * (`var(--space-N)`), el SVG escala solo (mismo círculo interno,
	 * ampliado o reducido). El truco de relleno es el estándar
	 * `stroke-dasharray`/`stroke-dashoffset` de un `<circle>` —
	 * `stroke-width` fijo del dibujo (no es una medida de diseño en
	 * px/rem, es un valor en las unidades internas del propio `viewBox`,
	 * igual que el resto de iconos SVG del paquete).
	 */
	const RADIUS = 42;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	interface Props {
		/** Fracción 0-1. Se recorta al rango válido. */
		value: number;
		label?: string;
		tone?: "neutral" | "success" | "warning" | "danger" | "info";
		size?: "sm" | "md" | "lg";
		/** Muestra el porcentaje centrado en el anillo (decorativo — el valor real ya lo lleva `aria-valuenow`). */
		showValueText?: boolean;
		class?: string;
	}

	let { value, label = "Progreso", tone = "neutral", size = "md", showValueText = false }: Props = $props();

	let clamped = $derived(Math.min(1, Math.max(0, value)));
	let percent = $derived(Math.round(clamped * 100));
	let dashoffset = $derived(CIRCUMFERENCE * (1 - clamped));
</script>

<div
	class="gg-circular-progress gg-circular-progress--{size}"
	role="progressbar"
	aria-label={label}
	aria-valuenow={percent}
	aria-valuemin={0}
	aria-valuemax={100}
>
	<svg class="gg-circular-progress__svg" viewBox="0 0 100 100">
		<circle class="gg-circular-progress__track" cx="50" cy="50" r={RADIUS} fill="none" stroke-width="10" />
		<circle
			class="gg-circular-progress__fill gg-circular-progress__fill--{tone}"
			cx="50"
			cy="50"
			r={RADIUS}
			fill="none"
			stroke-width="10"
			stroke-linecap="round"
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={dashoffset}
		/>
	</svg>
	{#if showValueText}
		<span class="gg-circular-progress__value" aria-hidden="true">{percent}%</span>
	{/if}
</div>

<style>
	.gg-circular-progress {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.gg-circular-progress--sm {
		width: var(--space-10);
		height: var(--space-10);
	}

	.gg-circular-progress--md {
		width: var(--space-16);
		height: var(--space-16);
	}

	.gg-circular-progress--lg {
		width: var(--space-24);
		height: var(--space-24);
	}

	.gg-circular-progress__svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.gg-circular-progress__track {
		stroke: var(--border);
	}

	.gg-circular-progress__fill {
		transition: stroke-dashoffset var(--duration-normal) var(--easing-standard);
	}

	.gg-circular-progress__fill--neutral {
		stroke: var(--interactive-primary);
	}

	.gg-circular-progress__fill--success {
		stroke: var(--status-success);
	}

	.gg-circular-progress__fill--warning {
		stroke: var(--status-warning);
	}

	.gg-circular-progress__fill--danger {
		stroke: var(--status-danger);
	}

	.gg-circular-progress__fill--info {
		stroke: var(--status-info);
	}

	.gg-circular-progress__value {
		position: absolute;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-circular-progress__fill {
			transition: none;
		}
	}
</style>
