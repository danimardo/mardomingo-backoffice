<script lang="ts">
	// W41 · `/admin/apps/[slug]/operaciones/[key]`: ficha de una operación de IA y su activación (T311; BE-FR-77). La comprobación
	// del modelo viene del catálogo guardado. Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m.admin_operation_title()}</title>
</svelte:head>

<h1>{m.admin_operation_title()}: {data.operation.key}</h1>
<p>
	{data.app.name} · {data.operation.kind} · {data.operation.model ?? m.admin_operation_no_model()}
</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_operation_error()}</Banner>
{/if}

<section aria-labelledby="estado">
	<h2 id="estado">{m.admin_operation_status()}</h2>
	<p>{data.operation.active ? m.admin_operation_active() : m.admin_operation_inactive()}</p>
	{#if data.rejection}
		<Banner level="warning">{m.admin_operation_rejection()}: {data.rejection}</Banner>
	{/if}
</section>

{#if !data.operation.active}
	<section aria-labelledby="activar">
		<h2 id="activar">{m.admin_operation_activate()}</h2>
		<form method="POST" action="?/activar">
			<TextField id="motivo" name="motivo" label={m.admin_operation_reason()} required />
			<Checkbox id="confirmado" name="confirmado" value="true"
				>{m.admin_operation_confirm()}</Checkbox
			>
			<p>
				<Button type="submit" variant="primary" disabled={!data.activatable}>
					{m.admin_operation_activate()}
				</Button>
			</p>
		</form>
	</section>
{/if}
