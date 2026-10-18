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

{#if data.operation.active}
	<section aria-labelledby="desactivar">
		<h2 id="desactivar">{m.admin_operation_deactivate()}</h2>
		<form method="POST" action="?/desactivar">
			<TextField id="motivo-desactivar" name="motivo" label={m.admin_operation_reason()} required />
			<Checkbox id="confirmado-desactivar" name="confirmado" value="true"
				>{m.admin_operation_confirm_deactivate()}</Checkbox
			>
			<p><Button type="submit" variant="secondary">{m.admin_operation_deactivate()}</Button></p>
		</form>
	</section>
{/if}

{#if data.operation.mode === 'plantilla'}
	<section aria-labelledby="plantilla">
		<h2 id="plantilla">{m.admin_operation_template()}</h2>
		<p>{m.admin_operation_template_hint()}</p>
		<form method="POST" action="?/guardarPlantilla">
			<label for="plantilla-texto">{m.admin_operation_template_body()}</label>
			<textarea id="plantilla-texto" name="plantilla" rows="16" required></textarea>
			<Checkbox id="confirmado-plantilla" name="confirmado" value="true"
				>{m.admin_operation_confirm_template()}</Checkbox
			>
			<p><Button type="submit" variant="primary">{m.admin_operation_template_save()}</Button></p>
		</form>
	</section>
{/if}

<section aria-labelledby="parametros">
	<h2 id="parametros">{m.admin_operation_settings()}</h2>
	<p>{m.admin_operation_settings_hint()}</p>
	<form method="POST" action="?/guardarOperacion">
		<TextField
			id="tiempoMs"
			name="tiempoMs"
			label={m.admin_operation_timeout()}
			value={data.operation.timeoutMs.toString()}
			required
		/>
		<TextField
			id="tokensSalida"
			name="tokensSalida"
			label={m.admin_operation_max_tokens()}
			value={data.operation.maxOutputTokens?.toString() ?? ''}
		/>
		<TextField
			id="temperaturaMilli"
			name="temperaturaMilli"
			label={m.admin_operation_temperature()}
			value={data.operation.temperatureMilli.toString()}
			required
		/>
		<TextField
			id="costeMaximoMicro"
			name="costeMaximoMicro"
			label={m.admin_operation_max_cost()}
			value={data.operation.maxCostMicro.toString()}
			required
		/>
		<TextField id="motivo-operacion" name="motivo" label={m.admin_operation_reason()} required />
		<Checkbox id="confirmado-operacion" name="confirmado" value="true"
			>{m.admin_operation_confirm_settings()}</Checkbox
		>
		<p><Button type="submit" variant="primary">{m.admin_operation_save_settings()}</Button></p>
	</form>
</section>
