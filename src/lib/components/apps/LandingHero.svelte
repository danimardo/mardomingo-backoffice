<script lang="ts">
	// Bloque principal de la landing (W01; T348). Composición abierta, sin caja: el titular y los accesos van directamente
	// sobre el fondo ambiental, centrados y con mucho espacio. Al no haber superficie de cristal, no hay nada que sustituir
	// con efectos reducidos; el contraste del texto se mide contra el fondo de la página (DS-09).
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		lead: string;
		children?: Snippet;
	}

	let { title, lead, children }: Props = $props();
</script>

<section class="hero" aria-labelledby="hero-titulo">
	<h1 id="hero-titulo">{title}</h1>
	<p class="lead">{lead}</p>
	{@render children?.()}
</section>

<style>
	.hero {
		display: grid;
		justify-items: center;
		gap: var(--space-6);
		padding: clamp(var(--space-12), 14vh, 9rem) 0 clamp(var(--space-10), 10vh, 6rem);
		text-align: center;
	}

	h1 {
		margin: 0;
		max-width: 16ch;
		font-size: clamp(2.75rem, 8vw, 5.5rem);
		font-weight: var(--font-weight-title);
		line-height: 1.02;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	.lead {
		margin: 0;
		max-width: 34rem;
		font-size: clamp(var(--font-size-lg), 2.4vw, var(--font-size-2xl));
		line-height: 1.4;
		color: var(--color-text-secondary);
		text-wrap: balance;
	}
</style>
