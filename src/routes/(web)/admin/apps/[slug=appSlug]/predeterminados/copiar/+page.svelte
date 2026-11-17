<script lang="ts">
	// W43 · copiar de la cuenta propia a los predeterminados (T312; BE-FR-42 CA3–CA4; D03). Una casilla por elemento, sin preselección. Solo
	// se sustituyen las categorías con algún elemento marcado. Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import CheckboxGroup from '$lib/components/ui/CheckboxGroup.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m.admin_defaults_copy_title()}</title>
</svelte:head>

<h1>{m.admin_defaults_copy_title()}: {data.app.name}</h1>
<p>{m.admin_defaults_copy_intro()}</p>

{#if form?.formError}
	<Banner level="critical"
		>{form.formError === 'NOTHING_SELECTED'
			? m.admin_defaults_nothing_selected()
			: m.admin_defaults_error()}</Banner
	>
{/if}

<form method="GET" action={resolve(`/admin/apps/${data.app.slug}/predeterminados/copiar`)}>
	<input type="hidden" name="vista" value="propia" />
	<p><Button type="submit" variant="secondary">{m.admin_defaults_preview()}</Button></p>
</form>

{#if data.preview && data.categories.length === 0}
	<p>{m.admin_defaults_no_data()}</p>
{/if}

{#if data.categories.length > 0}
	<form method="POST" action="?/copiar">
		{#each data.categories as category (category.category)}
			{#if category.personal}
				<Banner level="warning">{m.admin_defaults_personal_warning()}</Banner>
			{/if}
			<CheckboxGroup
				id={`sel-${category.category}`}
				name={`sel:${category.category}`}
				legend={category.category}
				options={category.elements.map((element) => ({ value: element, label: element }))}
			/>
		{/each}
		<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_defaults_confirm()}</Checkbox>
		<p><Button type="submit" variant="primary">{m.admin_defaults_copy_submit()}</Button></p>
	</form>
{/if}
