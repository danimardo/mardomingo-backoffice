<script lang="ts">
	// Estados: el selector de tema y el de efectos (`ThemeToggle` y `EffectsToggle`) muestran la elección actual. Teclado: son
	// formularios, sin JavaScript. Temas y efectos reducidos: sus colores son tokens.
	// Pie: texto de la marca, enlaces a los documentos legales y soporte, y los controles de apariencia, que vuelven a la
	// página actual tras enviarse. Los documentos legales están siempre a un enlace (BE-FR-60, BE-FR-70 CA2).
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import EffectsToggle from './EffectsToggle.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { Effects, Theme } from '$lib/appearance/preferences';

	interface Props {
		redirectTo: string;
		theme: Theme;
		effects: Effects;
		supportEmail?: string | null;
	}

	let { redirectTo, theme, effects, supportEmail = null }: Props = $props();
</script>

<footer class="footer">
	<div class="info">
		<p>{m.layout_footer_text()}</p>
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
		<EffectsToggle current={effects} {redirectTo} />
	</div>
</footer>

<style>
	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-6);
		margin-top: auto;
		padding: var(--space-6);
		border-top: 1px solid var(--border-subtle);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}

	.footer p {
		margin: 0;
	}

	.info {
		display: grid;
		gap: var(--space-3);
	}

	.info ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.info a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: inherit;
	}

	.info a:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-6);
	}
</style>
