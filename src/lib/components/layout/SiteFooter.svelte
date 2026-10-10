<script lang="ts">
	// Pie: texto de la marca y los controles de apariencia, que vuelven a la página actual tras enviarse.
	import * as m from '$lib/paraglide/messages.js';
	import EffectsToggle from './EffectsToggle.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { useAppearance } from '$lib/design-system/theme.svelte';

	interface Props {
		redirectTo: string;
	}

	let { redirectTo }: Props = $props();

	const appearance = useAppearance();
</script>

<footer class="footer">
	<p>{m.layout_footer_text()}</p>
	<div class="controls">
		<ThemeToggle current={appearance.theme} {redirectTo} />
		<EffectsToggle current={appearance.effects} {redirectTo} />
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

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-6);
	}
</style>
