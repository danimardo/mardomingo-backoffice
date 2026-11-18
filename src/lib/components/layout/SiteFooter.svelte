<script lang="ts">
	// Estados: el selector de tema (`ThemeToggle`) muestra la elección actual. Teclado: es un formulario. Temas: colores de tokens.
	// Pie mínimo: una fila con los enlaces legales, el soporte y el selector de tema, que vuelve a la página actual tras
	// enviarse. Los documentos legales están siempre a un enlace (BE-FR-60, BE-FR-70 CA2).
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { Theme } from '$lib/appearance/preferences';

	interface Props {
		redirectTo: string;
		theme: Theme;
		supportEmail?: string | null;
	}

	let { redirectTo, theme, supportEmail = null }: Props = $props();
</script>

<footer class="footer">
	<div class="info">
		<nav aria-label={m.layout_footer_nav_label()}>
			<ul>
				<li><a href={resolve('/terminos')}>{m.layout_footer_terms()}</a></li>
				<li><a href={resolve('/privacidad')}>{m.layout_footer_privacy()}</a></li>
				<li><a href={resolve('/cookies')}>{m.layout_footer_cookies()}</a></li>
				<li><a href={resolve('/uso-aceptable')}>{m.layout_footer_aup()}</a></li>
			</ul>
		</nav>
		{#if supportEmail !== null && supportEmail !== ''}
			<p>{m.layout_footer_support({ email: supportEmail })}</p>
		{/if}
	</div>
	<div class="controls">
		<ThemeToggle current={theme} {redirectTo} />
	</div>
</footer>

<style>
	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4) var(--space-8);
		box-sizing: border-box;
		width: min(100%, 68rem);
		margin: auto auto 0;
		padding: var(--space-8) var(--space-6);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.footer p {
		margin: 0;
	}

	.info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-6);
	}

	.info ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.info a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: inherit;
		text-decoration: none;
	}

	.info a:hover {
		color: var(--color-text-primary);
		text-decoration: underline;
	}

	.info a:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
