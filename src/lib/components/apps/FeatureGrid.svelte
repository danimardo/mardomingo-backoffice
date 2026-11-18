<script lang="ts">
	// Rejilla de ventajas de la landing: icono (Lucide, vía Icon), título y una línea. Sin tarjetas: respira sobre el fondo.
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	interface Item {
		icon: IconName;
		title: string;
		text: string;
	}

	interface Props {
		eyebrow: string;
		title: string;
		items: readonly Item[];
	}

	let { eyebrow, title, items }: Props = $props();
</script>

<section class="grid" aria-labelledby="hood-titulo">
	<p class="eyebrow">{eyebrow}</p>
	<h2 id="hood-titulo">{title}</h2>
	<ul>
		{#each items as item (item.title)}
			<li>
				<Icon name={item.icon} size={28} strokeWidth={1.5} />
				<strong>{item.title}</strong>
				<span>{item.text}</span>
			</li>
		{/each}
	</ul>
</section>

<style>
	.grid {
		text-align: center;
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}

	h2 {
		margin: 0 0 var(--space-12);
		font-size: clamp(var(--font-size-3xl), 5vw, 3rem);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.025em;
		line-height: 1.1;
	}

	ul {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
		gap: var(--space-10) var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
	}

	li :global(svg) {
		margin-bottom: var(--space-3);
		color: var(--color-text-primary);
	}

	strong {
		font-weight: var(--font-weight-control);
		color: var(--color-text-primary);
	}
</style>
