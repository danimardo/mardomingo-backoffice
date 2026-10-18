<script lang="ts">
	// W48 · `/admin/legal`: versiones vigentes y publicación de una nueva (T314; BE-FR-70). Sin JavaScript funciona igual.
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
	<title>{m.admin_legal_title()}</title>
</svelte:head>

<h1>{m.admin_legal_title()}</h1>
<p>{m.admin_legal_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_legal_error()}</Banner>
{/if}

<section aria-labelledby="vigentes">
	<h2 id="vigentes">{m.admin_legal_current()}</h2>
	<ul>
		{#each data.documents as doc (doc.document)}
			<li>
				{doc.document} · {doc.version ?? m.admin_legal_none()}{doc.requiresReacceptance
					? ` · ${m.admin_legal_reacceptance()}`
					: ''}
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="publicar">
	<h2 id="publicar">{m.admin_legal_publish()}</h2>
	<form method="POST" action="?/publicar">
		<TextField
			id="documento"
			name="documento"
			label={m.admin_legal_document()}
			hint="terms, privacy, aup, cookies…"
			error={errors.documento ?? ''}
			required
		/>
		<TextField
			id="version"
			name="version"
			label={m.admin_legal_version()}
			hint="AAAA-MM-DD"
			required
		/>
		<TextField id="contenido" name="contenido" label={m.admin_legal_content()} required />
		<Checkbox id="requiereReaceptacion" name="requiereReaceptacion" value="true"
			>{m.admin_legal_require_reacceptance()}</Checkbox
		>
		<Checkbox id="confirmado" name="confirmado" value="true">{m.admin_legal_confirm()}</Checkbox>
		<p><Button type="submit" variant="primary">{m.admin_legal_submit()}</Button></p>
	</form>
</section>
