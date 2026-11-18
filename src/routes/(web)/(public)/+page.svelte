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

<section class="block" aria-labelledby="como-titulo">
	<h2 id="como-titulo">{m.landing_how_title()}</h2>
	<p class="section-lead">{m.landing_how_text()}</p>
	<ul class="features">
		<li data-surface="glass">
			<h3>{m.landing_feature_account_title()}</h3>
			<p>{m.landing_feature_account_text()}</p>
		</li>
		<li data-surface="glass">
			<h3>{m.landing_feature_credits_title()}</h3>
			<p>{m.landing_feature_credits_text()}</p>
		</li>
		<li data-surface="glass">
			<h3>{m.landing_feature_usage_title()}</h3>
			<p>{m.landing_feature_usage_text()}</p>
		</li>
	</ul>
</section>

<section class="block" aria-labelledby="apps-titulo">
	<h2 id="apps-titulo">{m.landing_apps_title()}</h2>
	{#if data.apps.length === 0}
		<p class="section-lead">{m.landing_apps_empty()}</p>
	{:else}
		<ul class="apps">
			{#each data.apps as app (app.slug)}
				<li data-surface="glass">
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

<section class="closing block" aria-labelledby="cta-titulo">
	<h2 id="cta-titulo">{m.landing_cta_title()}</h2>
	<ul class="actions">
		<li>
			<Button href={resolve('/registro')} variant="primary">{m.layout_nav_register()}</Button>
		</li>
	</ul>
	<p><a href={resolve('/precios')}>{m.landing_prices_link()}</a></p>
	<p class="support">{m.landing_support({ email: data.supportEmail })}</p>
</section>

<style>
	.actions,
	.apps,
	.features {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
	}

	/* Secciones amplias, un mensaje cada una, con aire vertical generoso. */
	.block {
		margin-block: clamp(var(--space-16), 12vh, var(--space-32));
		text-align: center;
	}

	.block h2 {
		margin: 0 0 var(--space-3);
		font-size: clamp(var(--font-size-3xl), 5vw, 3rem);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.025em;
		line-height: 1.1;
		text-wrap: balance;
	}

	.section-lead {
		max-width: 38rem;
		margin: 0 auto var(--space-10);
		font-size: var(--font-size-lg);
		color: var(--color-text-secondary);
		text-wrap: balance;
	}

	.features,
	.apps {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		justify-content: center;
		margin-top: var(--space-8);
		text-align: left;
	}

	/* Cristal sin anidar y sin texto largo encima; con efectos reducidos pasa a superficie opaca (tokens del sistema). */
	.apps {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 19rem));
	}

	.features li,
	.apps li {
		padding: var(--space-8) var(--space-6);
		background: var(--gradient-card-hero);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card-hero);
		backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
		-webkit-backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
	}

	@supports not (backdrop-filter: blur(1px)) {
		.features li,
		.apps li {
			background: var(--surface-solid-card);
		}
	}

	.features h3,
	.apps h3 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-xl);
		letter-spacing: -0.01em;
	}

	.features p,
	.apps p {
		margin: 0 0 var(--space-3);
		color: var(--color-text-secondary);
	}

	.apps a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}

	.closing .actions {
		margin-block: var(--space-6) var(--space-4);
	}

	.closing p {
		margin-bottom: 0;
	}

	.support {
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
	}
</style>
