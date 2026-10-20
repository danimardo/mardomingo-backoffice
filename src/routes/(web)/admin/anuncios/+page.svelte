<script lang="ts">
	// W49 · `/admin/anuncios`: anuncios para una app o para todas, con su ventana y su desactivación (T315; BE-FR-85). Sin JavaScript
	// funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
	const appNames = $derived(new Map(data.apps.map((app) => [app.id, app.name])));
</script>

<svelte:head>
	<title>{m.admin_announcements_title()}</title>
</svelte:head>

<h1>{m.admin_announcements_title()}</h1>
<p>{m.admin_announcements_intro()}</p>

<section aria-labelledby="nuevo-anuncio">
	<h2 id="nuevo-anuncio">{m.admin_announcements_new()}</h2>
	<form method="POST" action="?/crear">
		<Select
			id="appId"
			name="appId"
			label={m.admin_announcements_app()}
			options={[
				{ value: '', label: m.admin_announcements_all_apps() },
				...data.apps.map((app) => ({ value: app.id, label: app.name }))
			]}
		/>
		<Select
			id="nivel"
			name="nivel"
			label={m.admin_announcements_level()}
			options={[
				{ value: 'info', label: 'Info' },
				{ value: 'warning', label: 'Aviso' },
				{ value: 'critical', label: 'Crítico' }
			]}
		/>
		<TextField
			id="mensaje"
			name="mensaje"
			label={m.admin_announcements_message()}
			error={errors.message ?? ''}
			required
		/>
		<TextField
			id="enlace"
			name="enlace"
			label={m.admin_announcements_link()}
			error={errors.link ?? ''}
		/>
		<TextField
			id="inicio"
			name="inicio"
			label={m.admin_announcements_starts()}
			error={errors.inicio ?? ''}
			required
		/>
		<TextField id="fin" name="fin" label={m.admin_announcements_ends()} error={errors.fin ?? ''} />
		<TextField
			id="minVersion"
			name="minVersion"
			label={m.admin_announcements_min_version()}
			error={errors.minVersion ?? ''}
		/>
		<TextField
			id="maxVersion"
			name="maxVersion"
			label={m.admin_announcements_max_version()}
			error={errors.maxVersion ?? ''}
		/>
		<p>
			<Button type="submit" formaction="?/previsualizar" variant="secondary"
				>{m.admin_announcements_preview()}</Button
			>
			<Button type="submit" variant="primary">{m.admin_announcements_submit()}</Button>
		</p>
	</form>
</section>

{#if form?.preview}
	<section aria-labelledby="vista-previa-anuncio">
		<h2 id="vista-previa-anuncio">{m.admin_announcements_preview_title()}</h2>
		<p>
			{form.preview.level} · {form.preview.message}{form.preview.link
				? ` · ${form.preview.link}`
				: ''}
		</p>
		<p>{m.admin_announcements_preview_note()}</p>
	</section>
{/if}

<section aria-labelledby="editar-anuncio">
	<h2 id="editar-anuncio">{m.admin_announcements_edit()}</h2>
	<p>{m.admin_announcements_edit_hint()}</p>
	<form method="POST" action="?/guardar">
		<TextField id="editar-id" name="anuncioId" label={m.admin_announcements_id()} required />
		<Select
			id="editar"
			name="appId"
			label={m.admin_announcements_app()}
			options={[
				{ value: '', label: m.admin_announcements_all_apps() },
				...data.apps.map((app) => ({ value: app.id, label: app.name }))
			]}
		/>
		<Select
			id="editar-nivel"
			name="nivel"
			label={m.admin_announcements_level()}
			options={[
				{ value: 'info', label: 'Info' },
				{ value: 'warning', label: 'Aviso' },
				{ value: 'critical', label: 'Crítico' }
			]}
		/>
		<TextField
			id="editar-mensaje"
			name="mensaje"
			label={m.admin_announcements_message()}
			required
		/>
		<TextField id="editar-enlace" name="enlace" label={m.admin_announcements_link()} />
		<TextField id="editar-inicio" name="inicio" label={m.admin_announcements_starts()} required />
		<TextField id="editar-fin" name="fin" label={m.admin_announcements_ends()} />
		<TextField
			id="editar-minVersion"
			name="minVersion"
			label={m.admin_announcements_min_version()}
		/>
		<TextField
			id="editar-maxVersion"
			name="maxVersion"
			label={m.admin_announcements_max_version()}
		/>
		<p><Button type="submit" variant="primary">{m.admin_announcements_save()}</Button></p>
	</form>
</section>

{#if form?.formError}
	<Banner level="critical">{form.formError}</Banner>
{/if}

<section aria-labelledby="lista-anuncios">
	<h2 id="lista-anuncios">{m.admin_announcements_title()}</h2>
	{#if data.announcements.length === 0}
		<p>{m.admin_announcements_empty()}</p>
	{:else}
		<ul>
			{#each data.announcements as row (row.id)}
				<li>
					{row.appId ? (appNames.get(row.appId) ?? row.appId) : m.admin_announcements_all_apps()} · {row.level}
					· {row.message} · <code>{row.id}</code>
					({row.active ? m.admin_announcements_active() : m.admin_announcements_inactive()})
					{#if row.active}
						<form method="POST" action="?/desactivar">
							<input type="hidden" name="anuncioId" value={row.id} />
							<TextField
								id={`motivo-anuncio-${row.id}`}
								name="motivo"
								label={m.admin_announcements_reason()}
								required
							/>
							<Checkbox id={`confirmado-anuncio-${row.id}`} name="confirmado" value="true"
								>{m.admin_announcements_confirm()}</Checkbox
							>
							<Button type="submit" variant="ghost">{m.admin_announcements_deactivate()}</Button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
