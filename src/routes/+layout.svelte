<script lang="ts">
	import '../app.css';
	import { untrack, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import AppBackground from '$lib/components/layout/AppBackground.svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
	import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';
	import { AppearanceState, applyToRoot, provideAppearance } from '$lib/design-system/theme.svelte';
	import { setClientLogLevel } from '$lib/logging/client';
	import * as m from '$lib/paraglide/messages.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// La instancia nace con la apariencia y el nivel del servidor; después los sigue `data` (efecto de abajo).
	const appearance = new AppearanceState(untrack(() => data.appearance));
	provideAppearance(appearance);
	setClientLogLevel(untrack(() => data.clientLogLevel));

	// Tras un envío de los controles, SvelteKit trae la apariencia nueva en `data`: se adopta sin recargar.
	$effect(() => {
		appearance.update(data.appearance);
	});

	$effect(() => {
		applyToRoot(document.documentElement, {
			theme: appearance.theme,
			effects: appearance.effects
		});
	});
</script>

<svelte:head>
	<title>{m.layout_home_title()}</title>
</svelte:head>

<SkipLink />
<AppBackground />
<SiteHeader />
<main id="contenido" tabindex="-1">
	{@render children()}
</main>
<SiteFooter redirectTo={`${page.url.pathname}${page.url.search}`} />

<style>
	main {
		flex: 1;
		width: min(100%, 60rem);
		margin: 0 auto;
		padding: var(--space-8) var(--space-6);
	}

	main:focus {
		outline: none;
	}
</style>
