<script lang="ts">
	// Bloque principal de la landing (W01; T348). Es una de las zonas donde el principio XIII permite cristal: con efectos
	// reducidos, o en navegadores sin `backdrop-filter`, la superficie es opaca (DS-05). El texto va siempre con el contraste
	// del tema sobre la superficie opaca de respaldo (DS-09).
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		lead: string;
		children?: Snippet;
	}

	let { title, lead, children }: Props = $props();
</script>

<section class="hero" data-surface="glass" aria-labelledby="hero-titulo">
	<h1 id="hero-titulo">{title}</h1>
	<p class="lead">{lead}</p>
	{@render children?.()}
</section>

<style>
	.hero {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-8) var(--space-6);
		background: var(--gradient-card-hero);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card-hero);
		backdrop-filter: blur(var(--blur-hero)) saturate(var(--material-saturate));
		-webkit-backdrop-filter: blur(var(--blur-hero)) saturate(var(--material-saturate));
	}

	@supports not (backdrop-filter: blur(1px)) {
		.hero {
			background: var(--surface-solid-card);
		}
	}

	h1 {
		margin: 0;
	}

	.lead {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-secondary, var(--color-text-primary));
	}
</style>
