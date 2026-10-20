<script lang="ts">
	// W40 · `/admin/apps/[slug]`: ficha de la app con sus sobrescrituras de límites (T310; BE-FR-61 CA3). Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Select from '$lib/components/ui/Select.svelte';
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

<section aria-labelledby="datos-app">
	<h2 id="datos-app">{m.admin_apps_details_heading()}</h2>
	<form method="POST" action="?/guardarApp">
		<TextField
			id="nombre"
			name="nombre"
			label={m.admin_apps_details_name()}
			value={data.details.name}
			required
		/>
		<TextField
			id="descripcion"
			name="descripcion"
			label={m.admin_apps_details_description()}
			value={data.details.description}
		/>
		<TextField
			id="soporte"
			name="soporte"
			label={m.admin_apps_details_support()}
			value={data.details.supportEmail}
		/>
		<TextField
			id="texto-post-verificacion"
			name="textoPostVerificacion"
			label={m.admin_apps_details_post_verify()}
			value={data.details.postVerifyText}
		/>
		<TextField
			id="enlaces"
			name="enlaces"
			label={m.admin_apps_details_links()}
			value={data.details.links}
			hint={m.admin_apps_hint_json()}
			required
		/>
		<TextField
			id="origenes"
			name="origenes"
			label={m.admin_apps_details_origins()}
			value={data.details.allowedOrigins}
			hint={m.admin_apps_hint_json()}
			required
		/>
		<TextField
			id="esquema-sincronizacion"
			name="esquemaSincronizacion"
			label={m.admin_apps_details_sync()}
			value={data.details.syncSchema}
			hint={m.admin_apps_hint_json()}
			required
		/>
		<TextField id="motivo-datos" name="motivo" label={m.admin_apps_reason()} required />
		<Checkbox id="confirmado-datos" name="confirmado" value="true"
			>{m.admin_apps_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="primary">{m.admin_apps_details_save()}</Button></p>
	</form>
</section>

<section aria-labelledby="versiones">
	<h2 id="versiones">{m.admin_apps_versions_heading()}</h2>
	<form method="POST" action="?/guardarVersiones">
		<TextField
			id="version-minima"
			name="versionMinima"
			label={m.admin_apps_versions_min()}
			value={data.versions.minAppVersion}
			hint="x.y.z"
		/>
		<TextField
			id="version-recomendada"
			name="versionRecomendada"
			label={m.admin_apps_versions_recommended()}
			value={data.versions.recommendedAppVersion}
			hint="x.y.z"
		/>
		<Checkbox
			id="exigir-version"
			name="exigirVersion"
			value="true"
			checked={data.versions.enforceVersion}>{m.admin_apps_versions_enforce()}</Checkbox
		>
		<TextField id="motivo-versiones" name="motivo" label={m.admin_apps_reason()} required />
		<Checkbox id="confirmado-versiones" name="confirmado" value="true"
			>{m.admin_apps_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="secondary">{m.admin_apps_versions_save()}</Button></p>
	</form>
</section>

<section aria-labelledby="nueva-operacion">
	<h2 id="nueva-operacion">{m.admin_apps_operation_new_heading()}</h2>
	<p>{m.admin_apps_operation_new_intro()}</p>
	<form method="POST" action="?/crearOperacion">
		<TextField id="op-clave" name="clave" label={m.admin_apps_operation_key()} required />
		<TextField id="op-nombre" name="nombre" label={m.admin_apps_operation_name()} required />
		<Select
			id="op-tipo"
			name="tipo"
			label={m.admin_apps_operation_kind()}
			options={[
				{ value: 'chat', label: m.admin_apps_operation_kind_chat() },
				{ value: 'transcription', label: m.admin_apps_operation_kind_transcription() },
				{ value: 'image', label: m.admin_apps_operation_kind_image() }
			]}
		/>
		<TextField id="op-modelo" name="modelo" label={m.admin_apps_operation_model()} />
		<TextField id="op-grupo" name="grupo" label={m.admin_apps_operation_group()} />
		<TextField id="op-tiempo" name="tiempoMs" label={m.admin_apps_operation_timeout()} required />
		<TextField
			id="op-coste"
			name="costeMaximoMicro"
			label={m.admin_apps_operation_max_cost()}
			required
		/>
		<TextField
			id="op-capacidades"
			name="capacidades"
			label={m.admin_apps_operation_capabilities()}
			hint={m.admin_apps_hint_json()}
			required
		/>
		<TextField id="motivo-operacion" name="motivo" label={m.admin_apps_reason()} required />
		<Checkbox id="confirmado-operacion" name="confirmado" value="true"
			>{m.admin_apps_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="secondary">{m.admin_apps_operation_create()}</Button></p>
	</form>
</section>

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
	<Button href={resolve(`/admin/apps/${data.app.slug}/predeterminados`)} variant="ghost"
		>{m.admin_apps_defaults_link()}</Button
	>
</p>
<p><Button href={resolve('/admin/apps')} variant="ghost">{m.admin_apps_title()}</Button></p>
