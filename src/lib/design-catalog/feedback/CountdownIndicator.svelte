<script lang="ts">
	/**
	 * CountdownIndicator (v1.12.0) — cuenta atrás visual y numérica para una acción automática que la persona
	 * puede cancelar. Anillo SVG con el arco del tono y el número de segundos restantes en el centro.
	 * `role="timer"`; se anuncia con `aria-live="polite"` solo a 60, 30, 10 y 0 s, nunca cada segundo.
	 */
	import type { FeedbackTone } from "./types.js";

	interface Props {
		/** Segundos restantes. */
		seconds: number;
		total?: number;
		tone?: FeedbackTone;
		/** Diámetro en unidades CSS de longitud (por defecto 3.5rem = 56 px). */
		size?: string;
		label?: (s: number) => string;
		class?: string;
	}

	let { seconds, total = 60, tone = "warning", size = "3.5rem", label = (s: number) => `Quedan ${s} segundos`, class: className = "", ...rest }: Props = $props();

	const R = 22; // radio del arco en el viewBox de 48
	const C = 2 * Math.PI * R;
	let fraction = $derived(total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0);

	const ANNOUNCE = new Set([60, 30, 10, 0]);
	let announcement = $state("");
	$effect(() => {
		if (ANNOUNCE.has(seconds)) announcement = label(seconds);
	});
</script>

<span class="gg-countdown gg-countdown--{tone} {className}" style:--gg-countdown-size={size} role="timer" aria-label={label(seconds)} {...rest}>
	<svg viewBox="0 0 48 48" class="gg-countdown__svg" aria-hidden="true">
		<circle class="gg-countdown__track" cx="24" cy="24" r={R} fill="none" stroke-width="4" />
		<circle class="gg-countdown__arc" cx="24" cy="24" r={R} fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - fraction)} transform="rotate(-90 24 24)" />
	</svg>
	<span class="gg-countdown__num" aria-hidden="true">{Math.max(0, Math.ceil(seconds))}</span>
	<span class="gg-countdown__live" aria-live="polite">{announcement}</span>
</span>

<style>
	.gg-countdown {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--gg-countdown-size);
		height: var(--gg-countdown-size);
		flex-shrink: 0;
		color: var(--status-warning);
	}

	.gg-countdown--info {
		color: var(--status-info);
	}
	.gg-countdown--danger {
		color: var(--status-danger);
	}
	.gg-countdown--success {
		color: var(--status-success);
	}
	.gg-countdown--neutral {
		color: var(--text-secondary);
	}

	.gg-countdown__svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.gg-countdown__track {
		stroke: var(--border);
	}

	.gg-countdown__arc {
		stroke: currentColor;
		transition: stroke-dashoffset var(--duration-slow) linear;
	}

	.gg-countdown__num {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		font-variant-numeric: tabular-nums;
	}

	.gg-countdown__live {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-countdown__arc {
			transition: none;
		}
	}
</style>
