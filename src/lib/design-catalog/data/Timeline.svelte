<script lang="ts">
	/**
	 * Timeline — historial cronológico de actividad (candidato #11 de la
	 * ronda de ampliación post-v0.13.0, ver docs/ROADMAP.md). Lista
	 * ordenada (`<ol>`, el orden cronológico ES semántica de lista) con
	 * un punto por entrada + línea de unión, mismo lenguaje visual que el
	 * punto no-textual de `DataCardStatus`/`Avatar` (tono = refuerzo,
	 * WCAG 1.4.11 ≥3:1, reutilizado sin volver a medir).
	 *
	 * Agrupación por fecha opcional: si una entrada trae `groupLabel`
	 * distinto de la anterior, se pinta un encabezado de grupo antes de
	 * ella — el propio dataset decide los grupos ("Hoy"/"Ayer"/fecha...),
	 * `Timeline` no calcula fechas relativas por sí sola (igual que
	 * `FilterBar` no decide qué es un filtro: el consumidor ya trae la
	 * forma final).
	 *
	 * Contraste del punto con tono (cuando lleva `icon`): NO reutiliza el
	 * tinte al 12-18% de `Alert`/`Chip` con el color de estado como
	 * primer plano — ese par nunca se verificó (el tinte de Fase 5 se
	 * diseñó para texto NEUTRO encima, no para el propio color de estado
	 * como icono). En vez de medir uno nuevo, reutiliza el par YA
	 * verificado de `Badge`--count (blanco sobre el peldaño fijo de
	 * escala: `success-800`/`warning-800`/`danger-600`/`info-600`/
	 * `neutral-600`, ver la nota de contraste completa en `Badge.svelte`)
	 * — mismo criterio de "no inventar un par nuevo si uno ya probado
	 * sirve" que atraviesa todo el paquete.
	 */
	import type { Snippet } from "svelte";

	export interface TimelineItem {
		value: string;
		title: string;
		description?: string;
		/** Momento ya formateado por el consumidor (p. ej. "hace 2 horas", "10:32") — `Timeline` no formatea fechas. */
		timestamp?: string;
		tone?: "success" | "warning" | "danger" | "info" | "neutral";
		/** Encabezado de grupo a pintar justo antes de esta entrada, si es distinto del de la entrada anterior. */
		groupLabel?: string;
		icon?: Snippet;
	}

	interface Props {
		items: TimelineItem[];
		class?: string;
	}

	let { items, class: className = "" }: Props = $props();
</script>

<ol class="gg-timeline {className}">
	{#each items as item, i (item.value)}
		{#if item.groupLabel && item.groupLabel !== items[i - 1]?.groupLabel}
			<li class="gg-timeline__group" role="presentation">{item.groupLabel}</li>
		{/if}
		<li class="gg-timeline__item">
			<div class="gg-timeline__marker-col">
				<span class="gg-timeline__dot gg-timeline__dot--{item.tone ?? 'neutral'}" aria-hidden="true">
					{#if item.icon}
						{@render item.icon()}
					{/if}
				</span>
				{#if i < items.length - 1}
					<span class="gg-timeline__line" aria-hidden="true"></span>
				{/if}
			</div>
			<div class="gg-timeline__body">
				<div class="gg-timeline__head">
					<span class="gg-timeline__title">{item.title}</span>
					{#if item.timestamp}
						<span class="gg-timeline__timestamp">{item.timestamp}</span>
					{/if}
				</div>
				{#if item.description}
					<p class="gg-timeline__description">{item.description}</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>

<style>
	.gg-timeline {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-timeline__group {
		padding-block: var(--space-2);
		margin-inline-start: calc(var(--space-6) + var(--space-3));
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.gg-timeline__item {
		display: flex;
		gap: var(--space-3);
	}

	.gg-timeline__marker-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
	}

	.gg-timeline__dot {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-6);
		height: var(--space-6);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		color: var(--text-secondary);
	}

	.gg-timeline__dot--success {
		background: var(--success-800);
		color: var(--color-white);
	}

	.gg-timeline__dot--warning {
		background: var(--warning-800);
		color: var(--color-white);
	}

	.gg-timeline__dot--danger {
		background: var(--danger-600);
		color: var(--color-white);
	}

	.gg-timeline__dot--info {
		background: var(--info-600);
		color: var(--color-white);
	}

	.gg-timeline__line {
		flex: 1;
		width: 2px;
		min-height: var(--space-6);
		background: var(--border);
		margin-block: var(--space-1);
	}

	.gg-timeline__body {
		flex: 1;
		min-width: 0;
		padding-block-end: var(--space-5);
	}

	.gg-timeline__head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.gg-timeline__title {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
	}

	.gg-timeline__timestamp {
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}

	.gg-timeline__description {
		margin: var(--space-1) 0 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}
</style>
