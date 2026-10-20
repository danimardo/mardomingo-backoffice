<script lang="ts">
	// Documento legal vigente (W04–W07; T351). Siempre sobre una superficie opaca: es texto largo que se lee entero y no
	// admite cristal (16.3). El HTML lo genera el servidor con `renderMarkdown`, que escapa toda la entrada.
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		title: string;
		version: string;
		/** Día de publicación (`YYYY-MM-DD`). */
		publishedOn: string;
		/** HTML ya generado y escapado por el servidor. */
		contentHtml: string;
	}

	let { title, version, publishedOn, contentHtml }: Props = $props();
</script>

<article class="legal">
	<h1>{title}</h1>
	<p class="meta">{m.legal_document_meta({ version, date: publishedOn })}</p>
	<div class="content">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML escapado por `renderMarkdown` (T347), no entrada de usuario -->
		{@html contentHtml}
	</div>
</article>

<style>
	.legal {
		background: var(--surface-solid-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-6);
		max-width: 48rem;
	}

	.meta {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.content :global(h2) {
		margin-top: var(--space-6);
	}

	.content :global(a) {
		text-decoration: underline;
	}
</style>
