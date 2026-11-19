<script lang="ts">
	// Bloque principal de la landing (W01; T348). Marco redondeado con degradado ambiental y la maqueta del panel asomando
	// por abajo; sin superficie de cristal propia, así que no hay nada que sustituir con efectos reducidos. Los colores son
	// tokens mezclados con el fondo de la página, por lo que sirven en claro y en oscuro (DS-09: el texto va sobre esa mezcla).
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		lead: string;
		note: string;
		children?: Snippet;
		mockup?: Snippet;
	}

	let { eyebrow, title, lead, note, children, mockup }: Props = $props();
</script>

<section class="hero" aria-labelledby="hero-titulo">
	<div class="copy">
		<p class="eyebrow">{eyebrow}</p>
		<h1 id="hero-titulo">{title}</h1>
		<p class="lead">{lead}</p>
		{@render children?.()}
		<p class="note">{note}</p>
	</div>
	{@render mockup?.()}
</section>

<style>
	/* En pantallas estrechas el marco ocupa la columna más parte del relleno de `main`, con porcentajes: `vw` no se reduce con
	   el zoom de la página y desbordaría (UX-16). En pantallas anchas se sale de la columna hasta un ancho máximo. */
	.hero {
		position: relative;
		display: grid;
		gap: var(--space-12);
		box-sizing: border-box;
		width: calc(100% + 2 * (var(--space-6) - var(--space-4)));
		margin: calc(-1 * var(--space-20)) 0 var(--space-12)
			calc(-1 * (var(--space-6) - var(--space-4)));
		padding: var(--space-24) var(--space-6) 0;
		overflow: hidden;
		border-radius: var(--space-8);
		background:
			radial-gradient(
				60% 70% at 8% 85%,
				color-mix(in oklab, var(--warning-300) 70%, transparent),
				transparent 70%
			),
			radial-gradient(
				55% 65% at 95% 30%,
				color-mix(in oklab, var(--primary-300) 65%, transparent),
				transparent 70%
			),
			radial-gradient(
				70% 80% at 40% 0%,
				color-mix(in oklab, var(--accent-300) 70%, transparent),
				transparent 75%
			),
			color-mix(in oklab, var(--primary-100) 40%, var(--color-bg-base));
	}

	@media (min-width: 64rem) {
		.hero {
			width: min(100vw - var(--space-8), 72rem);
			margin-left: calc(50% - min(50vw - var(--space-4), 36rem));
		}
	}

	@media (max-width: 40rem) {
		.hero {
			padding-top: calc(var(--space-24) + var(--space-12));
		}
	}

	.copy {
		display: grid;
		justify-items: center;
		gap: var(--space-4);
		text-align: center;
	}

	.eyebrow {
		margin: 0;
		padding: var(--space-1) var(--space-4);
		border-radius: 999px;
		background: color-mix(in oklab, var(--color-bg-base) 60%, transparent);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}

	h1 {
		margin: 0;
		max-width: 14ch;
		font-size: clamp(2.5rem, 7vw, 4.75rem);
		font-weight: var(--font-weight-title);
		line-height: 1.04;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	.lead {
		margin: 0 0 var(--space-2);
		max-width: 32rem;
		font-size: clamp(var(--font-size-lg), 2.2vw, var(--font-size-xl));
		line-height: 1.4;
		color: var(--color-text-secondary);
		text-wrap: balance;
	}

	.note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}
</style>
