<script lang="ts">
	// W01 · Landing de la marca (T348; BE-FR-59, FR-100): qué es la Cuenta Mardomingo, las apps activas y los accesos. Estados
	// de 16.6: sin ninguna app activa (vacío legítimo) y app con landing externa (enlace visible, sin redirección).
	import { resolve } from '$app/paths';
	import LandingHero from '$lib/components/apps/LandingHero.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.layout_home_title()}</title>
</svelte:head>

<LandingHero title={m.common_app_name()} lead={m.home_intro()}>
	<ul class="actions">
		<li>
			<Button href={resolve('/registro')} variant="primary">{m.layout_nav_register()}</Button>
		</li>
		<li><Button href={resolve('/login')} variant="secondary">{m.account_sign_in()}</Button></li>
	</ul>
</LandingHero>

<section aria-labelledby="apps-titulo">
	<h2 id="apps-titulo">{m.landing_apps_title()}</h2>
	{#if data.apps.length === 0}
		<p>{m.landing_apps_empty()}</p>
	{:else}
		<ul class="apps">
			{#each data.apps as app (app.slug)}
				<li>
					<h3>{app.name}</h3>
					{#if app.description !== ''}
						<p>{app.description}</p>
					{/if}
					{#if app.landing.kind === 'external' && app.landing.url !== null}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- landing externa configurada por el administrador -->
						<a href={app.landing.url} rel="noopener">{m.landing_app_external({ name: app.name })}</a
						>
					{:else}
						<a href={resolve(`/apps/${app.slug}`)}>{m.landing_app_more({ name: app.name })}</a>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="como-titulo">
	<h2 id="como-titulo">{m.landing_how_title()}</h2>
	<p>{m.landing_how_text()}</p>
	<p><a href={resolve('/precios')}>{m.landing_prices_link()}</a></p>
	<p>{m.landing_support({ email: data.supportEmail })}</p>
</section>

<style>
	.actions,
	.apps {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.apps {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
	}

	.apps li {
		padding: var(--space-4);
		background: var(--surface-solid-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.apps h3 {
		margin-top: 0;
	}

	.apps a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
</style>
