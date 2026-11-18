<script lang="ts">
	// W01 · Landing de la marca (T348; BE-FR-59, FR-100): qué es la Cuenta Mardomingo, las apps activas y los accesos. Estados
	// de 16.6: sin ninguna app activa (vacío legítimo) y app con landing externa (enlace visible, sin redirección).
	import { resolve } from '$app/paths';
	import FaqList from '$lib/components/apps/FaqList.svelte';
	import FeatureGrid from '$lib/components/apps/FeatureGrid.svelte';
	import FeatureTabs from '$lib/components/apps/FeatureTabs.svelte';
	import LandingHero from '$lib/components/apps/LandingHero.svelte';
	import PanelMockup from '$lib/components/apps/PanelMockup.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tabs = [
		{
			id: 'cuenta',
			label: m.landing_tab_account(),
			title: m.landing_tab_account_title(),
			text: m.landing_tab_account_text()
		},
		{
			id: 'creditos',
			label: m.landing_tab_credits(),
			title: m.landing_tab_credits_title(),
			text: m.landing_tab_credits_text()
		},
		{
			id: 'apps',
			label: m.landing_tab_apps(),
			title: m.landing_tab_apps_title(),
			text: m.landing_tab_apps_text()
		}
	] as const;

	const hood = [
		{ icon: 'user', title: m.landing_hood_1_title(), text: m.landing_hood_1_text() },
		{ icon: 'wallet', title: m.landing_hood_2_title(), text: m.landing_hood_2_text() },
		{ icon: 'receipt', title: m.landing_hood_3_title(), text: m.landing_hood_3_text() },
		{ icon: 'lock', title: m.landing_hood_4_title(), text: m.landing_hood_4_text() },
		{ icon: 'history', title: m.landing_hood_5_title(), text: m.landing_hood_5_text() },
		{ icon: 'support', title: m.landing_hood_6_title(), text: m.landing_hood_6_text() },
		{ icon: 'layers', title: m.landing_hood_7_title(), text: m.landing_hood_7_text() },
		{ icon: 'sparkles', title: m.landing_hood_8_title(), text: m.landing_hood_8_text() }
	] as const;

	const faq = $derived([
		{ question: m.landing_faq_1_q(), answer: m.landing_faq_1_a() },
		{ question: m.landing_faq_2_q(), answer: m.landing_faq_2_a() },
		{ question: m.landing_faq_3_q(), answer: m.landing_faq_3_a() },
		{ question: m.landing_faq_4_q(), answer: m.landing_faq_4_a() },
		{ question: m.landing_faq_5_q(), answer: m.landing_faq_5_a({ email: data.supportEmail }) }
	]);
</script>

<svelte:head>
	<title>{m.layout_home_title()}</title>
</svelte:head>

<LandingHero
	eyebrow={m.landing_eyebrow()}
	title={m.common_app_name()}
	lead={m.home_intro()}
	note={m.landing_hero_note()}
>
	<ul class="actions">
		<li>
			<Button href={resolve('/registro')} variant="primary">{m.layout_nav_register()}</Button>
		</li>
		<li><Button href={resolve('/login')} variant="secondary">{m.account_sign_in()}</Button></li>
	</ul>
	{#snippet mockup()}
		<PanelMockup />
	{/snippet}
</LandingHero>

<div class="block">
	<FeatureTabs label={m.landing_tabs_label()} {tabs} />
</div>

<div class="block">
	<FeatureGrid eyebrow={m.landing_hood_eyebrow()} title={m.landing_hood_title()} items={hood} />
</div>

<section class="apps-block block" aria-labelledby="apps-titulo">
	<h2 id="apps-titulo">{m.landing_apps_title()}</h2>
	{#if data.apps.length === 0}
		<p class="empty">{m.landing_apps_empty()}</p>
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
	<p class="prices"><a href={resolve('/precios')}>{m.landing_prices_link()}</a></p>
</section>

<div class="block">
	<FaqList title={m.landing_faq_title()} items={faq} />
</div>

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
		justify-content: center;
		gap: var(--space-3);
	}

	.block {
		margin-block: clamp(var(--space-16), 12vh, var(--space-32));
	}

	.apps-block {
		text-align: center;
	}

	.apps-block h2 {
		margin: 0 0 var(--space-8);
		font-size: clamp(var(--font-size-3xl), 5vw, 3rem);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.025em;
		line-height: 1.1;
	}

	.empty {
		color: var(--color-text-secondary);
	}

	.apps {
		display: grid;
		gap: var(--space-4);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 19rem));
		justify-content: center;
		text-align: left;
	}

	/* Cristal sin anidar y sin texto largo encima; con efectos reducidos pasa a superficie opaca (tokens del sistema). */
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
		.apps li {
			background: var(--surface-solid-card);
		}
	}

	.apps h3 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-xl);
		letter-spacing: -0.01em;
	}

	.apps p {
		margin: 0 0 var(--space-3);
		color: var(--color-text-secondary);
	}

	.apps a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}

	.prices {
		margin: var(--space-8) 0 0;
	}
</style>
