<script lang="ts">
	/**
	 * PieChart (v1.5.0) — gráfico circular de pocas porciones que suman un total (p. ej. los días de un cupo:
	 * disfrutados, futuros y restantes). Siempre se acompaña de una leyenda con el nombre y el número de cada porción:
	 * el color nunca es la única forma de leerlo (WCAG 1.4.1). El SVG es estático (sin JavaScript de dibujo).
	 *
	 * - `label` es el nombre accesible de la imagen (`role="img"`): compón en él los números para quien no ve el gráfico.
	 * - Una porción con valor 0 aparece en la leyenda pero no se dibuja; un valor negativo o no finito cuenta como 0.
	 * - Si el total es 0 no se dibuja ningún sector: queda solo la leyenda.
	 * - El color de cada porción es `--chart-N` (N = posición, de 1 a 8); `colorIndex` lo fija si hace falta.
	 */
	import type { Snippet } from "svelte";

	interface Segment {
		label: string;
		value: number;
		/** 1-8: índice de `--chart-N`. Por defecto, la posición de la porción. */
		colorIndex?: number;
	}

	interface Props {
		segments: Segment[];
		/** Nombre accesible de la imagen. */
		label: string;
		size?: "sm" | "md" | "lg";
		/** Unidad que sigue a cada número de la leyenda (p. ej. "días"). */
		unit?: string;
		/** Unidad en singular, para el número 1 (p. ej. "día"); sin ella se usa `unit`. */
		unitOne?: string;
		/** Texto bajo el gráfico y la leyenda (p. ej. una aclaración). */
		children?: Snippet;
		class?: string;
	}

	let { segments, label, size = "md", unit = "", unitOne, children, class: className = "" }: Props = $props();

	function unitFor(value: number): string {
		return value === 1 && unitOne !== undefined ? unitOne : unit;
	}

	const CHART_COLORS = 8;

	function clean(value: number): number {
		return Number.isFinite(value) && value > 0 ? value : 0;
	}

	let total = $derived(segments.reduce((sum, segment) => sum + clean(segment.value), 0));

	/** Longitud (sobre 100) y desfase de cada sector dibujado. */
	let sectors = $derived.by(() => {
		let offset = 0;
		return segments.flatMap((segment, index) => {
			const value = clean(segment.value);
			if (value === 0 || total === 0) return [];
			const length = (value / total) * 100;
			const sector = {
				key: `${index}:${segment.label}`,
				length,
				offset,
				color: ((segment.colorIndex ?? index + 1) - 1) % CHART_COLORS + 1
			};
			offset += length;
			return [sector];
		});
	});
</script>

<figure class="gg-pie-chart gg-pie-chart--{size} {className}">
	{#if total > 0}
		<svg class="gg-pie-chart__svg" viewBox="0 0 32 32" role="img" aria-label={label}>
			<g transform="rotate(-90 16 16)">
				{#each sectors as sector (sector.key)}
					<circle
						class="gg-pie-chart__sector"
						cx="16"
						cy="16"
						r="8"
						fill="none"
						stroke="var(--chart-{sector.color})"
						stroke-width="16"
						pathLength="100"
						stroke-dasharray="{sector.length} {100 - sector.length}"
						stroke-dashoffset={-sector.offset}
					/>
				{/each}
			</g>
		</svg>
	{/if}
	<figcaption class="gg-pie-chart__caption">
		<ul class="gg-pie-chart__legend" aria-label={total > 0 ? undefined : label}>
			{#each segments as segment, index (`${index}:${segment.label}`)}
				<li class="gg-pie-chart__item">
					<span
						class="gg-pie-chart__swatch"
						style:background-color="var(--chart-{((segment.colorIndex ?? index + 1) - 1) % CHART_COLORS + 1})"
						aria-hidden="true"
					></span>
					<span class="gg-pie-chart__name">{segment.label}</span>
					<span class="gg-pie-chart__value">{clean(segment.value)}{unitFor(clean(segment.value)) ? ` ${unitFor(clean(segment.value))}` : ""}</span>
				</li>
			{/each}
		</ul>
		{#if children}
			<div class="gg-pie-chart__note">{@render children()}</div>
		{/if}
	</figcaption>
</figure>

<style>
	.gg-pie-chart {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		margin: 0;
	}

	.gg-pie-chart__svg {
		flex-shrink: 0;
		border-radius: var(--radius-full);
	}

	.gg-pie-chart--sm .gg-pie-chart__svg {
		width: var(--space-24);
		height: var(--space-24);
	}

	.gg-pie-chart--md .gg-pie-chart__svg {
		width: var(--space-32);
		height: var(--space-32);
	}

	.gg-pie-chart--lg .gg-pie-chart__svg {
		width: var(--space-40);
		height: var(--space-40);
	}

	.gg-pie-chart__caption {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.gg-pie-chart__legend {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-pie-chart__item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-pie-chart__swatch {
		flex-shrink: 0;
		width: var(--space-3);
		height: var(--space-3);
		border-radius: var(--radius-sm);
	}

	.gg-pie-chart__value {
		font-weight: 600;
	}

	.gg-pie-chart__note {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}
</style>
