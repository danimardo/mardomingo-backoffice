<script lang="ts">
	// W39 · `/admin/apps`: apps de la plataforma y alta de una nueva (T310; BE-FR-61, BE-FR-62). Los campos complejos van como JSON validado
	// por el servicio. Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
</script>

<svelte:head>
	<title>{m.admin_apps_title()}</title>
</svelte:head>

<h1>{m.admin_apps_title()}</h1>
<p>{m.admin_apps_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_apps_error()}</Banner>
{/if}

<section aria-labelledby="lista-apps">
	<h2 id="lista-apps">{m.admin_apps_list_heading()}</h2>
	<ul>
		{#each data.apps as app (app.id)}
			<li>
				<a href={resolve(`/admin/apps/${app.slug}`)}>{app.name}</a> · {app.status}
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="nueva-app">
	<h2 id="nueva-app">{m.admin_apps_new_heading()}</h2>
	<form method="POST" action="?/crearApp">
		<TextField
			id="slug"
			name="slug"
			label={m.admin_apps_slug()}
			error={errors.slug ?? ''}
			required
		/>
		<TextField id="nombre" name="nombre" label={m.admin_apps_name()} required />
		<TextField id="descripcion" name="descripcion" label={m.admin_apps_description()} />
		<TextField
			id="tiposCliente"
			name="tiposCliente"
			label={m.admin_apps_client_types()}
			hint={m.admin_apps_hint_client_types()}
		/>
		<TextField
			id="enlaces"
			name="enlaces"
			label={m.admin_apps_links()}
			hint={m.admin_apps_hint_links()}
		/>
		<TextField
			id="esquemaSincronizacion"
			name="esquemaSincronizacion"
			label={m.admin_apps_sync_schema()}
			hint={m.admin_apps_hint_sync()}
		/>
		<TextField
			id="origenes"
			name="origenes"
			label={m.admin_apps_origins()}
			hint={m.admin_apps_hint_origins()}
		/>
		<TextField id="soporte" name="soporte" label={m.admin_apps_support()} />
		<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_apps_confirm()}</Checkbox>
		<p><Button type="submit" variant="primary">{m.admin_apps_create()}</Button></p>
	</form>
</section>
