<script lang="ts">
	// W42 · predeterminados de una app: edición en JSON validada por el esquema de sincronización (T312; BE-FR-42). No modifica cuentas.
	// Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
</script>

<svelte:head>
	<title>{m.admin_defaults_title()}</title>
</svelte:head>

<h1>{m.admin_defaults_title()}: {data.app.name}</h1>
<p>{m.admin_defaults_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_defaults_error()}</Banner>
{/if}

<form method="POST" action="?/guardarPredeterminados">
	<label for="datos">{m.admin_defaults_json()}</label>
	<textarea id="datos" name="datos" rows="16" aria-invalid={errors.datos ? 'true' : undefined}
		>{data.defaultsJson}</textarea
	>
	{#if errors.datos}
		<p role="alert">{m.admin_defaults_json_invalid()}</p>
	{/if}
	<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_defaults_confirm()}</Checkbox>
	<p><Button type="submit" variant="primary">{m.admin_defaults_save()}</Button></p>
</form>

<p>
	<a href={resolve(`/admin/apps/${data.app.slug}/predeterminados/copiar`)}
		>{m.admin_defaults_copy_link()}</a
	>
</p>
