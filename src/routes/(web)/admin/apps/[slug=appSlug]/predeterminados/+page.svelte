<script lang="ts">
	// W42 · predeterminados de una app: edición en JSON validada por el esquema de sincronización (T312; BE-FR-42). No modifica cuentas.
	// Exige motivo y confirmación (BE-FR-55; C-41). Avisa si el esquema vigente ya no admite alguna categoría (C-45). Sin
	// JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { REASON_MAX_LENGTH, reasonFieldOf } from '$lib/schemas/common/reason';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
	// Tras un fallo se vuelve a pintar lo escrito, no el documento guardado.
	const category = $derived(form && 'category' in form ? form.category : undefined);
	const written = $derived(form?.values.datos ?? data.defaultsJson);
</script>

<svelte:head>
	<title>{m.admin_defaults_title()}</title>
</svelte:head>

<h1>{m.admin_defaults_title()}: {data.app.name}</h1>
<p>{m.admin_defaults_intro()}</p>

{#if data.saved !== null}
	<p role="status">
		{m.admin_notice_saved()}
		<a href="{resolve('/admin/auditoria')}/{encodeURIComponent(data.saved)}"
			>{m.admin_notice_audit_link()}</a
		>
	</p>
{/if}

{#if form?.formError}
	<Banner level="critical">{m.admin_defaults_error()}</Banner>
{/if}

<form method="POST" action="?/guardarPredeterminados">
	<label for="datos">{m.admin_defaults_json()}</label>
	<textarea id="datos" name="datos" rows="16" aria-invalid={errors.datos ? 'true' : undefined}
		>{written}</textarea
	>
	{#if errors.datos}
		<p role="alert">
			{category
				? m.admin_defaults_json_category_invalid({ category })
				: m.admin_defaults_json_invalid()}
		</p>
	{/if}
	<TextField
		id="motivo"
		name="motivo"
		label={m.admin_defaults_reason()}
		required
		maxlength={REASON_MAX_LENGTH}
		{...reasonFieldOf(form)}
	/>
	<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_defaults_confirm()}</Checkbox>
	<p><Button type="submit" variant="primary">{m.admin_defaults_save()}</Button></p>
</form>

<p>
	<Button href={resolve(`/admin/apps/${data.app.slug}/predeterminados/copiar`)} variant="ghost"
		>{m.admin_defaults_copy_link()}</Button
	>
</p>
