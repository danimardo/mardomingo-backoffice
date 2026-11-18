<script lang="ts">
	/**
	 * DataCardStatus — indicador de estado: punto de color + etiqueta de
	 * texto NEUTRO (`--text-secondary`), no coloreada.
	 *
	 * Decisión de contraste deliberada: `--status-danger`/`--status-info`
	 * como TEXTO solo pasan AA contra `--surface`/`--surface-sunken`, no
	 * contra `--surface-raised` (4.10:1 / 3.59:1 en oscuro — ver
	 * docs/TOKENS.md) — y `DataCard` vive sobre `--surface-raised`
	 * (`Card` con `elevation="raised"`). El punto, en cambio, es
	 * información NO textual (WCAG 1.4.11, ≥3:1) y los cuatro colores de
	 * estado pasan ese umbral con holgura contra `--surface-raised` en
	 * ambos temas (mínimo 3.59:1) — así que el color vive en el punto, el
	 * texto se queda en un tono siempre seguro.
	 */
	interface Props {
		tone?: "success" | "warning" | "danger" | "info" | "neutral";
		label: string;
		class?: string;
	}

	let { tone = "neutral", label, class: className = "" }: Props = $props();
</script>

<span class="gg-data-card-status {className}">
	<span class="gg-data-card-status__dot gg-data-card-status__dot--{tone}" aria-hidden="true"></span>
	<span class="gg-data-card-status__label">{label}</span>
</span>

<style>
	.gg-data-card-status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.gg-data-card-status__dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.gg-data-card-status__dot--success {
		background: var(--status-success);
	}

	.gg-data-card-status__dot--warning {
		background: var(--status-warning);
	}

	.gg-data-card-status__dot--danger {
		background: var(--status-danger);
	}

	.gg-data-card-status__dot--info {
		background: var(--status-info);
	}

	.gg-data-card-status__dot--neutral {
		background: var(--text-disabled);
	}

	.gg-data-card-status__label {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}
</style>
