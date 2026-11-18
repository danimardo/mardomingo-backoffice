<script lang="ts">
	/**
	 * StatCard (§20, catálogo completo) — una de las 13 variantes de
	 * `Card` dejadas fuera en Fase 4 (ver `docs/ROADMAP.md`): un único
	 * indicador (valor grande + etiqueta + tendencia opcional). Compone
	 * `Card`/`CardBody` (Fase 4) en vez de reimplementar el fondo/
	 * elevación/padding — mismo criterio que ya evitó que `DataCard`
	 * tuviera su propia cabecera/cuerpo/pie.
	 *
	 * La tendencia NUNCA usa el color de tono como texto: un triángulo
	 * (▲/▼, decorativo, `aria-hidden`) teñido con `--status-success`/
	 * `--status-danger`, más la etiqueta en `--text-secondary` — el
	 * MISMO patrón "punto/icono no textual + texto neutro" que
	 * `DataCardStatus` (Fase 4), reutilizado sin verificación nueva
	 * porque el contexto es idéntico (dentro de un `Card`, fondo
	 * `--surface-raised`). `tone` es explícito (no se infiere de
	 * `direction`) porque una tendencia "al alza" no siempre es buena
	 * noticia (un coste que sube, por ejemplo) — quien construye el
	 * dashboard decide el color, no el signo de la cifra.
	 */
	import type { Snippet } from "svelte";
	import Card from "./Card.svelte";
	import CardBody from "./CardBody.svelte";
	import { Icon } from "../icons/index.js";
	import type { ElevationToken } from "../primitives/types.js";

	interface Trend {
		direction: "up" | "down" | "neutral";
		/** Texto de la tendencia (p. ej. "+12% vs. mes anterior") — nunca solo el icono. */
		label: string;
		tone?: "success" | "warning" | "danger" | "neutral";
	}

	interface Props {
		label: string;
		value: string | number;
		icon?: Snippet;
		trend?: Trend;
		elevation?: ElevationToken;
		class?: string;
	}

	let { label, value, icon, trend, elevation = "raised", class: className = "" }: Props = $props();

	const TREND_TONE: Record<Trend["direction"], NonNullable<Trend["tone"]>> = { up: "success", down: "danger", neutral: "neutral" };
	let resolvedTone = $derived(trend ? (trend.tone ?? TREND_TONE[trend.direction]) : "neutral");
</script>

<Card {elevation} class="gg-stat-card {className}">
	<CardBody>
		<div class="gg-stat-card__top">
			<span class="gg-stat-card__label">{label}</span>
			{#if icon}
				<span class="gg-stat-card__icon" aria-hidden="true">{@render icon()}</span>
			{/if}
		</div>
		<span class="gg-stat-card__value">{value}</span>
		{#if trend}
			<span class="gg-stat-card__trend">
				{#if trend.direction === "up" || trend.direction === "down"}
					<Icon
						name={trend.direction === "up" ? "trend-up" : "trend-down"}
						tone={resolvedTone}
						class="gg-stat-card__trend-arrow gg-stat-card__trend-arrow--{resolvedTone}"
						size="1em"
						legacySvg={{
							viewBox: "0 0 12 12",
							fill: "currentColor",
							body: trend.direction === "up" ? '<path d="M6 2l5 6H1z" />' : '<path d="M6 10L1 4h10z" />'
						}}
					/>
				{:else}
					<svg class="gg-stat-card__trend-arrow gg-stat-card__trend-arrow--{resolvedTone}" aria-hidden="true" width="1em" height="1em" viewBox="0 0 12 12" fill="currentColor">
						<rect x="1" y="5" width="10" height="2" rx="1" />
					</svg>
				{/if}
				<span class="gg-stat-card__trend-label">{trend.label}</span>
			</span>
		{/if}
	</CardBody>
</Card>

<style>
	.gg-stat-card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.gg-stat-card__label {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-stat-card__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-5);
		height: var(--space-5);
		color: var(--text-muted);
	}

	.gg-stat-card__value {
		display: block;
		margin-top: var(--space-1);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-h3-size);
		font-weight: var(--text-h3-weight);
		line-height: var(--text-h3-leading);
	}

	.gg-stat-card__trend {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}

	:global(.gg-stat-card__trend-arrow--success) {
		color: var(--status-success);
	}

	:global(.gg-stat-card__trend-arrow--warning) {
		color: var(--status-warning);
	}

	:global(.gg-stat-card__trend-arrow--danger) {
		color: var(--status-danger);
	}

	:global(.gg-stat-card__trend-arrow--neutral) {
		color: var(--text-disabled);
	}

	.gg-stat-card__trend-label {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
	}
</style>
