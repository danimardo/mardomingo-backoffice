<script lang="ts">
	// W32 · `/panel/apps`: apps activas con su descripción, marca de «usada», y descarga o acceso cuando están configurados.
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.apps_title()}</title>
</svelte:head>

<h1>{m.apps_title()}</h1>

{#if data.apps.length === 0}
	<EmptyState variant="empty" />
{:else}
	<ul class="apps">
		{#each data.apps as app (app.id)}
			<li class="app">
				<h2>{app.name}</h2>
				{#if app.description !== ''}
					<p>{app.description}</p>
				{/if}
				<p>{app.used ? m.apps_used() : m.apps_not_used()}</p>
				{#if app.downloadUrl !== null}
					<Button href={app.downloadUrl} variant="primary"
						>{m.apps_download({ name: app.name })}</Button
					>
				{:else}
					<p>{m.apps_download_unavailable()}</p>
				{/if}
				{#if app.accessUrl !== null}
					<Button href={app.accessUrl} variant="secondary"
						>{m.apps_access({ name: app.name })}</Button
					>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.apps {
		display: grid;
		gap: 1rem;
		list-style: none;
		padding: 0;
	}
	.app {
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
	}
</style>
