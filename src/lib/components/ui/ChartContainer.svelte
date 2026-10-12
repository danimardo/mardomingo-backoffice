<script lang="ts">
	// Contenedor de gráficas del panel (DS-06, UX-08; T256). Muestra título, periodo, unidad («créditos») y vigencia, y siempre
	// incluye la tabla equivalente en el HTML: es el contenido sin JavaScript y lo que leen los lectores de pantalla. La gráfica
	// (LayerChart) va como `children`. Un día sin datos (`null`) se escribe como «Sin datos», no como cero. Con `busy`, el
	// contenedor reserva su altura para que la carga no mueva la página (sin CLS).
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Point {
		readonly label: string;
		readonly value: number | null;
	}

	let {
		title,
		period,
		unit,
		validity,
		points,
		busy = false,
		children
	}: {
		title: string;
		period: string;
		unit: string;
		validity: string;
		points: readonly Point[];
		busy?: boolean;
		children?: Snippet;
	} = $props();
</script>

<figure class="chart" aria-busy={busy ? 'true' : undefined}>
	<figcaption>
		<h2>{title}</h2>
		<p>{m.chart_meta({ period, unit, validity })}</p>
	</figcaption>
	<div class="plot">
		{#if children}{@render children()}{/if}
	</div>
	<table>
		<caption>{title}</caption>
		<thead>
			<tr>
				<th scope="col">{m.chart_day()}</th>
				<th scope="col" class="num">{unit}</th>
			</tr>
		</thead>
		<tbody>
			{#each points as point, index (index)}
				<tr>
					<td>{point.label}</td>
					<td class="num">{point.value === null ? m.chart_no_data() : String(point.value)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</figure>

<style>
	.chart {
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
	.plot {
		min-height: 12rem;
		color: var(--color-chart-axis-label);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 0.4rem 0.6rem;
		text-align: start;
		border-top: 1px solid var(--border-subtle);
	}
	.num {
		text-align: end;
	}
</style>
