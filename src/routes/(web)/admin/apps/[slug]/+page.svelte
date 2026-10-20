<script lang="ts">
	// W40 · `/admin/apps/[slug]`: ficha de la app con sus sobrescrituras de límites (T310; BE-FR-61 CA3). Sin JavaScript funciona igual.
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
	<title>{data.app.name}</title>
</svelte:head>

<h1>{data.app.name}</h1>
<p>{data.app.slug} · {data.app.status}</p>
{#if data.app.description}
	<p>{data.app.description}</p>
{/if}

{#if form?.formError}
	<Banner level="critical">{m.admin_apps_error()}</Banner>
{/if}

<section aria-labelledby="mantenimiento">
	<h2 id="mantenimiento">{m.admin_apps_maintenance_heading()}</h2>
	<form method="POST" action="?/previsualizarMantenimiento">
		<Checkbox id="activo-mantenimiento" name="activo" value="true"
			>{m.admin_apps_maintenance_active()}</Checkbox
		>
		<TextField
			id="mensaje-mantenimiento"
			name="mensaje"
			label={m.admin_apps_maintenance_message()}
			value={data.app.maintenanceMessage}
		/>
		<p><Button type="submit" variant="secondary">{m.admin_apps_maintenance_preview()}</Button></p>
	</form>

	{#if form?.maintenancePreview}
		<section aria-labelledby="vista-previa-mantenimiento">
			<h3 id="vista-previa-mantenimiento">{m.admin_apps_maintenance_preview_title()}</h3>
			<p>
				{form.maintenancePreview.before.active
					? m.admin_apps_maintenance_on()
					: m.admin_apps_maintenance_off()}
				→
				{form.maintenancePreview.after.active
					? m.admin_apps_maintenance_on()
					: m.admin_apps_maintenance_off()}
			</p>
			<form method="POST" action="?/guardarMantenimiento">
				<input
					type="hidden"
					name="activo"
					value={form.maintenancePreview.after.active ? 'true' : 'false'}
				/>
				<input type="hidden" name="mensaje" value={form.maintenancePreview.after.message} />
				<TextField id="motivo-mantenimiento" name="motivo" label={m.admin_apps_reason()} required />
				<Checkbox id="confirmado-mantenimiento" name="confirmado" value="true"
					>{m.admin_apps_confirm()}</Checkbox
				>
				<p><Button type="submit" variant="primary">{m.admin_apps_maintenance_save()}</Button></p>
			</form>
		</section>
	{/if}
</section>

<section aria-labelledby="sobrescrituras">
	<h2 id="sobrescrituras">{m.admin_apps_overrides_heading()}</h2>
	<p>{m.admin_apps_overrides_intro()}</p>
	<form method="POST" action="?/guardarSobrescrituras">
		<TextField
			id="sobrescrituras-json"
			name="sobrescrituras"
			label={m.admin_apps_overrides_json()}
			error={errors.sobrescrituras ?? ''}
			hint={m.admin_apps_hint_overrides()}
			required
		/>
		<TextField id="motivo" name="motivo" label={m.admin_apps_reason()} required />
		<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_apps_confirm()}</Checkbox>
		<p><Button type="submit" variant="primary">{m.admin_apps_save()}</Button></p>
	</form>
</section>

<p>
	<a href={resolve(`/admin/apps/${data.app.slug}/predeterminados`)}
		>{m.admin_apps_defaults_link()}</a
	>
</p>
<p><a href={resolve('/admin/apps')}>{m.admin_apps_title()}</a></p>
