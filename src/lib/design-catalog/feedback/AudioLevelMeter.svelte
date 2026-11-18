<script lang="ts">
	/**
	 * AudioLevelMeter (v1.12.0) — medidor de nivel de audio en tiempo real para micrófono, salida o canal.
	 * `variant="bars"`: barras verticales de alturas crecientes (las que superan el nivel quedan en `--border`).
	 * `variant="bar"`: barra horizontal segmentada con huecos. `role="meter"`; `aria-valuenow` solo se actualiza
	 * una vez por segundo para no saturar a los lectores de pantalla. No anima entre muestras.
	 */
	import type { FeedbackTone } from "./types.js";

	interface Props {
		/** RMS normalizado, 0-1. */
		level?: number;
		/** Marca de pico opcional, 0-1. */
		peak?: number;
		variant?: "bars" | "bar";
		segments?: number;
		tone?: FeedbackTone;
		/** Nombre accesible (obligatorio). */
		label: string;
		/** Canal parado: sin tramos activos y atenuado. */
		disabled?: boolean;
		class?: string;
	}

	let { level = 0, peak, variant = "bars", segments, tone = "success", label, disabled = false, class: className = "", ...rest }: Props = $props();

	let n = $derived(segments ?? (variant === "bars" ? 6 : 8));
	let clamped = $derived(Math.min(1, Math.max(0, level)));
	let active = $derived(disabled ? 0 : Math.round(clamped * n));
	let peakIndex = $derived(peak === undefined || disabled ? -1 : Math.min(n - 1, Math.max(0, Math.round(Math.min(1, Math.max(0, peak)) * n) - 1)));

	// `aria-valuenow` se refresca como mucho cada segundo.
	let announced = $state(0);
	let lastAnnounce = 0;
	$effect(() => {
		const now = Date.now();
		const value = disabled ? 0 : Math.round(clamped * 100);
		if (now - lastAnnounce >= 1000) {
			lastAnnounce = now;
			announced = value;
		}
	});

	function barHeight(i: number): string {
		// Alturas crecientes de 4 a 16 px: de --space-1 a --space-4.
		return `calc(var(--space-1) + (var(--space-4) - var(--space-1)) * ${n > 1 ? i / (n - 1) : 1})`;
	}
</script>

<span class="gg-meter gg-meter--{variant} gg-meter--{tone} {className}" class:gg-meter--disabled={disabled} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={announced} {...rest}>
	{#each Array.from({ length: n }, (_, i) => i) as i (i)}
		<span
			class="gg-meter__seg"
			class:gg-meter__seg--on={i < active}
			class:gg-meter__seg--peak={i === peakIndex && i >= active}
			style:height={variant === "bars" ? barHeight(i) : undefined}
		></span>
	{/each}
</span>

<style>
	.gg-meter {
		display: inline-flex;
		gap: var(--space-1);
		color: var(--status-success);
	}

	.gg-meter--bars {
		align-items: flex-end;
		height: var(--space-4);
	}

	.gg-meter--bar {
		align-items: stretch;
		width: var(--space-24);
		height: calc(var(--space-1) * 1.5);
	}

	.gg-meter--info {
		color: var(--status-info);
	}
	.gg-meter--warning {
		color: var(--status-warning);
	}
	.gg-meter--danger {
		color: var(--status-danger);
	}
	.gg-meter--neutral {
		color: var(--text-secondary);
	}

	.gg-meter__seg {
		background: var(--border);
		border-radius: var(--radius-full);
	}

	.gg-meter--bars .gg-meter__seg {
		width: 3px;
	}

	.gg-meter--bar .gg-meter__seg {
		flex: 1;
	}

	.gg-meter__seg--on {
		background: currentColor;
	}

	.gg-meter__seg--peak {
		background: color-mix(in srgb, currentColor 55%, var(--border));
	}

	.gg-meter--disabled {
		opacity: 0.5;
	}
</style>
