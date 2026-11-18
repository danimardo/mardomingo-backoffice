<script lang="ts">
	/**
	 * LiveIndicator (v1.12.0) — indicador inequívoco de que se está enviando un flujo de datos (audio a un
	 * servicio) en este momento. Encendido: punto que late + «En directo» en `--text-info`. Apagado: sin punto y
	 * «Sin envío» en `--text-muted`. La diferencia no es solo de color: cambian el texto y la presencia del punto.
	 * El cambio de encendido a apagado lo anuncia el `role="status"` del contenedor (p. ej. `StatusIsland`),
	 * no este componente, para no duplicar anuncios: aquí `role="status"` solo sin `aria-live`.
	 */
	import { tooltip } from "./tooltip.js";

	interface Props {
		on?: boolean;
		onLabel?: string;
		offLabel?: string;
		/** Detalle de lo que se envía: tooltip y `aria-describedby`. */
		detail?: string;
		size?: "sm" | "md";
		class?: string;
	}

	const uid = $props.id();
	let { on = false, onLabel = "En directo", offLabel = "Sin envío", detail, size = "sm", class: className = "", ...rest }: Props = $props();
</script>

<span class="gg-live gg-live--{size} {on ? 'gg-live--on' : 'gg-live--off'} {className}" role="status" aria-live="off" aria-describedby={detail ? `${uid}-detail` : undefined} use:tooltip={{ content: detail ?? "" }} {...rest}>
	{#if on}<span class="gg-live__dot" aria-hidden="true"></span>{/if}
	<span class="gg-live__label">{on ? onLabel : offLabel}</span>
	{#if detail}<span class="gg-live__detail" id="{uid}-detail">{detail}</span>{/if}
</span>

<style>
	.gg-live {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.gg-live--sm {
		font-size: var(--text-overline-size);
	}

	.gg-live--md {
		font-size: var(--text-caption-size);
	}

	.gg-live--on {
		color: var(--text-info);
	}

	.gg-live--off {
		color: var(--text-muted);
	}

	.gg-live__dot {
		width: calc(var(--space-1) * 1.5);
		height: calc(var(--space-1) * 1.5);
		border-radius: var(--radius-full);
		background: currentColor;
		animation: gg-live-pulse 1.8s ease-in-out infinite;
	}

	.gg-live__detail {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.gg-live {
		position: relative;
	}

	@keyframes gg-live-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-live__dot {
			animation: none;
		}
	}
</style>
