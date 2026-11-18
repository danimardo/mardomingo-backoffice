<script lang="ts">
	/**
	 * VolumeControl (v1.12.0) — control compacto de volumen en una fila: etiqueta, `Slider` del sistema y valor
	 * en % con números tabulares. Efecto inmediato y sin confirmación. Delega teclado y ARIA en `Slider`
	 * (flechas ±1, Re Pág/Av Pág ±10, Inicio/Fin; `aria-valuetext` = valor formateado).
	 */
	import Slider from "./Slider.svelte";

	interface Props {
		/** 0-100. */
		value?: number;
		label: string;
		/** Ancho de la etiqueta (CSS). Por defecto 8rem; con `compact`, 4rem. */
		labelWidth?: string;
		disabled?: boolean;
		compact?: boolean;
		formatValue?: (n: number) => string;
		onchange?: (n: number) => void;
		class?: string;
	}

	let { value = $bindable(100), label, labelWidth, disabled = false, compact = false, formatValue = (n: number) => `${n} %`, onchange, class: className = "", ...rest }: Props = $props();

	let width = $derived(labelWidth ?? (compact ? "4rem" : "8rem"));
	let last = value;
	$effect(() => {
		if (value !== last) {
			last = value;
			onchange?.(value);
		}
	});
</script>

<div class="gg-volume {className}" class:gg-volume--compact={compact} class:gg-volume--disabled={disabled} style:--gg-volume-label={width} {...rest}>
	<span class="gg-volume__label">{label}</span>
	<div class="gg-volume__slider"><Slider bind:value min={0} max={100} step={1} {disabled} {label} {formatValue} /></div>
	<span class="gg-volume__value" aria-hidden="true">{formatValue(value)}</span>
</div>

<style>
	.gg-volume {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-sans);
	}

	.gg-volume--compact {
		gap: var(--space-2);
	}

	.gg-volume__label {
		flex: 0 0 var(--gg-volume-label);
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-volume--compact .gg-volume__label {
		font-size: var(--text-caption-size);
	}

	.gg-volume__slider {
		flex: 1;
		min-width: 0;
	}

	.gg-volume__value {
		flex: 0 0 auto;
		min-width: 3.5ch;
		color: var(--text-muted);
		font-size: var(--text-caption-size);
		font-variant-numeric: tabular-nums;
		text-align: end;
	}

	.gg-volume--disabled .gg-volume__label,
	.gg-volume--disabled .gg-volume__value {
		color: var(--text-disabled);
	}
</style>
