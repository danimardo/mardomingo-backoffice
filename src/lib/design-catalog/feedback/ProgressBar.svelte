<script lang="ts">
	/**
	 * ProgressBar (§24, catálogo completo) — indicador de progreso
	 * DETERMINADO (con cifra), el patrón que `Spinner` (Fase 5) dejó
	 * fuera a propósito ("en curso, sin cifra" es todo lo que cubre
	 * `Spinner"). `UpdatePrompt` (Fase 7) ya dibujaba una barra
	 * determinada para `state="downloading"`, pero como detalle INTERNO
	 * suyo, no exportado — esta es la pieza SUELTA equivalente, para
	 * cualquier progreso determinado que no sea una actualización de
	 * Tauri (subida de fichero, importación de datos...).
	 *
	 * `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/
	 * `aria-valuemax` nativos — mismo patrón que la barra de
	 * `UpdatePrompt`. `value` se recibe como fracción 0-1 (no 0-100),
	 * igual que `progress` en `UpdatePrompt.svelte` — un solo vocabulario
	 * de "progreso" en todo el paquete en vez de dos convenciones
	 * distintas entre piezas hermanas.
	 *
	 * Contraste del relleno: NINGÚN color de `tono` se verifica aquí
	 * desde cero — todos reutilizan pares YA verificados como TEXTO
	 * contra `--surface`/`--surface-sunken` desde Fase 1/3 (mínimo
	 * 4.94:1 en ambos temas, ver `docs/TOKENS.md`), con margen de sobra
	 * sobre el umbral no-textual real que aplica aquí (WCAG 1.4.11,
	 * ≥3:1 — el relleno es color, no texto). La pista usa
	 * `--surface-sunken`, el mismo fondo "hundido" ya usado como base
	 * neutra en `FilterBar`/chips (Fase 6).
	 */
	interface Props {
		/** Fracción 0-1. Se recorta al rango válido. */
		value: number;
		label?: string;
		tone?: "neutral" | "success" | "warning" | "danger" | "info";
		/** Muestra el porcentaje como texto junto a la barra (decorativo — el valor real ya lo lleva `aria-valuenow`). */
		showValueText?: boolean;
		class?: string;
	}

	let { value, label = "Progreso", tone = "neutral", showValueText = false, class: className = "" }: Props = $props();

	let clamped = $derived(Math.min(1, Math.max(0, value)));
	let percent = $derived(Math.round(clamped * 100));
</script>

<div class="gg-progress-bar {className}">
	<div class="gg-progress-bar__track" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
		<div class="gg-progress-bar__fill gg-progress-bar__fill--{tone}" style="width:{percent}%;"></div>
	</div>
	{#if showValueText}
		<span class="gg-progress-bar__value" aria-hidden="true">{percent}%</span>
	{/if}
</div>

<style>
	.gg-progress-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.gg-progress-bar__track {
		flex: 1;
		box-sizing: border-box;
		height: var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		overflow: hidden;
	}

	.gg-progress-bar__fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width var(--duration-normal) var(--easing-standard);
	}

	.gg-progress-bar__fill--neutral {
		background: var(--interactive-primary);
	}

	.gg-progress-bar__fill--success {
		background: var(--status-success);
	}

	.gg-progress-bar__fill--warning {
		background: var(--status-warning);
	}

	.gg-progress-bar__fill--danger {
		background: var(--status-danger);
	}

	.gg-progress-bar__fill--info {
		background: var(--status-info);
	}

	.gg-progress-bar__value {
		flex-shrink: 0;
		min-width: 2.5em;
		text-align: right;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-progress-bar__fill {
			transition: none;
		}
	}
</style>
