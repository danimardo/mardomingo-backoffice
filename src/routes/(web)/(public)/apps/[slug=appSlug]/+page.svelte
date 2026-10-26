<script lang="ts">
	// W02 · Landing de una app (T349; BE-FR-59, FR-101, UX-16): qué hace, cómo empezar, descarga o acceso y «Crear cuenta» con la
	// app de origen. Estados de 16.6: app desactivada, descarga no disponible y app con landing externa (enlace visible, sin
	// redirección automática). En un instalador sin firmar se explican en texto los pasos de SmartScreen. La captura autoalojada
	// (`static/images/smartscreen-secretario.webp`, UX-16) queda pendiente: hay que hacerla en un Windows real.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.app.name}</title>
</svelte:head>

<h1>{data.app.name}</h1>
{#if data.app.description !== ''}
	<p>{data.app.description}</p>
{/if}

{#if data.disabled}
	<Banner level="warning">{m.app_page_disabled({ name: data.app.name })}</Banner>
{:else}
	<section aria-labelledby="empezar-titulo">
		<h2 id="empezar-titulo">{m.app_page_start_title()}</h2>
		<ol>
			<li>{m.app_page_step_account()}</li>
			{#if data.app.download !== null}
				<li>{m.app_page_step_download({ name: data.app.name })}</li>
			{:else if data.app.access !== null}
				<li>{m.app_page_step_access({ name: data.app.name })}</li>
			{/if}
			<li>{m.app_page_step_login()}</li>
		</ol>
		{#if data.registerHref !== null}
			<p>
				<Button href={data.registerHref} variant="primary">{m.layout_nav_register()}</Button>
			</p>
		{/if}
	</section>

	{#if data.app.download !== null}
		<section aria-labelledby="descarga-titulo">
			<h2 id="descarga-titulo">{m.app_page_download_title()}</h2>
			{#if data.app.download.available && data.app.download.url !== null}
				<p>
					<Button href={data.app.download.url} variant="secondary"
						>{m.app_page_download({ name: data.app.name })}</Button
					>
				</p>
			{:else}
				<Banner level="info">{m.app_page_download_unavailable()}</Banner>
			{/if}
		</section>
	{/if}

	{#if data.app.access !== null}
		<section aria-labelledby="acceso-titulo">
			<h2 id="acceso-titulo">{m.app_page_access_title()}</h2>
			<p>
				<Button href={data.app.access.url} variant="secondary"
					>{m.app_page_access({ name: data.app.name })}</Button
				>
			</p>
		</section>
	{/if}

	{#if data.app.externalLanding !== null}
		<p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- landing externa configurada por el administrador -->
			<a href={data.app.externalLanding} rel="noopener">{m.app_page_external()}</a>
		</p>
	{/if}

	{#if data.app.smartScreenHelp}
		<section aria-labelledby="smartscreen-titulo">
			<h2 id="smartscreen-titulo">{m.app_page_smartscreen_title()}</h2>
			<p>{m.app_page_smartscreen_intro()}</p>
			<ol>
				<li>{m.app_page_smartscreen_step_more()}</li>
				<li>{m.app_page_smartscreen_step_run()}</li>
			</ol>
		</section>
	{/if}
{/if}

<p>{m.landing_support({ email: data.supportEmail })}</p>
<p><a href={resolve('/')}>{m.app_page_back()}</a></p>
