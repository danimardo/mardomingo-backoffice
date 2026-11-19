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
	<!-- Poppins propia: solo se precargan los pesos de la portada (400 cuerpo y 600 subtítulos). crossorigin es obligatorio
	     para fuentes aunque sean del mismo origen; la CSP (font-src 'self') ya lo permite. -->
	<link
		rel="preload"
		as="font"
		type="font/woff2"
		href="/fonts/poppins/poppins-latin-400-normal.woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		as="font"
		type="font/woff2"
		href="/fonts/poppins/poppins-latin-600-normal.woff2"
		crossorigin="anonymous"
	/>
	<title>{m.layout_home_title()}</title>
</svelte:head>

<SkipLink />
<AppBackground />
<SiteHeader signedIn={data.account.signedIn} isAdmin={data.account.isAdmin} />
<main id="contenido" tabindex="-1">
	{@render children()}
</main>
<SiteFooter
	redirectTo={`${page.url.pathname}${page.url.search}`}
	theme={appearance.theme}
	supportEmail={data.supportEmail}
/>

<style>
	main {
		flex: 1;
		width: min(100%, 60rem);
		margin: 0 auto;
		padding: var(--space-24) var(--space-6) var(--space-8);
	}

	/* En móvil la píldora de la cabecera ocupa dos filas: el contenido empieza por debajo de ella. */
	@media (max-width: 40rem) {
		main {
			padding-top: calc(var(--space-24) + var(--space-12));
		}
	}

	main:focus {
		outline: none;
	}
</style>
