<script lang="ts">
	// W44 · `/admin/protecciones`: límites de protección y freno de coste diario (T313; BE-FR-43, BE-FR-46). Cada cambio pide confirmación
	// y motivo. Sin JavaScript funciona igual.
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
	<title>{m.admin_protections_title()}</title>
</svelte:head>

<h1>{m.admin_protections_title()}</h1>
<p>{m.admin_protections_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_protections_error()}</Banner>
{/if}

<section aria-labelledby="freno">
	<h2 id="freno">{m.admin_protections_brake_heading()}</h2>
	<p>
		{data.brake.active ? m.admin_protections_brake_active() : m.admin_protections_brake_inactive()}
	</p>
	{#if data.brake.active}
		<form method="POST" action="?/liberarFreno">
			<TextField
				id="motivo-freno"
				name="motivo"
				label={m.admin_protections_reason()}
				error={errors.motivo ?? ''}
				required
			/>
			<Checkbox id="confirmado-freno" name="confirmado" value="true"
				>{m.admin_protections_confirm()}</Checkbox
			>
			<p><Button type="submit" variant="primary">{m.admin_protections_release()}</Button></p>
		</form>
	{/if}
</section>

<section aria-labelledby="limites">
	<h2 id="limites">{m.admin_protections_limits_heading()}</h2>
	{#each data.limits as limit (limit.key)}
		<form method="POST" action="?/guardarLimites">
			<input type="hidden" name="clave" value={limit.key} />
			<TextField
				id={`valor-${limit.key}`}
				name="valor"
				label={`${limit.key} (${m.admin_protections_current()}: ${limit.value})`}
			/>
			<p>{m.admin_economy_scope_global()}</p>
			<TextField id={`motivo-${limit.key}`} name="motivo" label={m.admin_protections_reason()} />
			<Checkbox id={`confirmado-${limit.key}`} name="confirmado" value="true"
				>{m.admin_protections_confirm()}</Checkbox
			>
			<p>
				<Button type="submit" formaction="?/previsualizarLimites" variant="ghost"
					>{m.admin_protections_preview()}</Button
				>
				<Button type="submit" variant="secondary">{m.admin_protections_save()}</Button>
			</p>
		</form>
	{/each}

	{#if form?.preview}
		<section aria-labelledby="vista-previa-limite">
			<h3 id="vista-previa-limite">{m.admin_protections_preview_title()}</h3>
			{#if form.preview.valid}
				<p>
					{form.preview.key}: {form.preview.before ?? ''} → {form.preview.after ?? ''} ({m.admin_economy_scope_global()})
				</p>
				<form method="POST" action="?/guardarLimites">
					<input type="hidden" name="clave" value={form.preview.key} />
					<input type="hidden" name="valor" value={form.preview.after ?? ''} />
					<TextField
						id="motivo-vista-previa"
						name="motivo"
						label={m.admin_protections_reason()}
						required
					/>
					<Checkbox id="confirmado-vista-previa" name="confirmado" value="true"
						>{m.admin_protections_confirm()}</Checkbox
					>
					<p><Button type="submit" variant="primary">{m.admin_protections_save()}</Button></p>
				</form>
			{:else}
				<Banner level="critical">{m.admin_protections_error()}</Banner>
			{/if}
		</section>
	{/if}
</section>

<p><Button href={resolve('/admin/usuarios')} variant="ghost">{m.admin_users_title()}</Button></p>
