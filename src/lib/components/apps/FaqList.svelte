<script lang="ts">
	// Preguntas frecuentes de la landing: acordeón nativo con <details name>, que abre una sola a la vez y lo maneja el
	// navegador con el teclado. Las respuestas son texto plano.
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Item {
		question: string;
		answer: string;
	}

	interface Props {
		title: string;
		items: readonly Item[];
	}

	let { title, items }: Props = $props();
</script>

<section class="faq" aria-labelledby="faq-titulo">
	<h2 id="faq-titulo">{title}</h2>
	<div class="list">
		{#each items as item (item.question)}
			<details name="faq">
				<summary>
					<span>{item.question}</span>
					<Icon name="chevron-down" size={18} />
				</summary>
				<p>{item.answer}</p>
			</details>
		{/each}
	</div>
</section>

<style>
	.faq {
		text-align: center;
	}

	h2 {
		margin: 0 0 var(--space-10);
		font-size: clamp(var(--font-size-3xl), 5vw, 3rem);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.025em;
		line-height: 1.1;
	}

	.list {
		overflow: hidden;
		max-width: 40rem;
		margin: 0 auto;
		border: 1px solid var(--border-subtle);
		border-radius: var(--space-5);
		background: var(--surface-solid-card);
		text-align: left;
	}

	details + details {
		border-top: 1px solid var(--border-subtle);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: 44px;
		padding: var(--space-4) var(--space-5);
		font-weight: var(--font-weight-control);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary :global(svg) {
		flex: none;
		color: var(--color-text-muted);
	}

	details[open] summary :global(svg) {
		transform: rotate(180deg);
	}

	summary:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: -2px;
	}

	p {
		margin: 0;
		padding: 0 var(--space-5) var(--space-5);
		color: var(--color-text-secondary);
	}
</style>
