<script lang="ts">
	// W38 · `/admin/economia`: parámetros económicos globales, tipo de cambio manual y precio orientativo manual (T309; BE-FR-61,
	// BE-FR-73, BE-FR-87). Cada cambio pide motivo y confirmación. Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m.admin_economy_title()}</title>
</svelte:head>

<h1>{m.admin_economy_title()}</h1>
<p>{m.admin_economy_intro()}</p>

{#if form?.formError}
	<Banner level="critical">{m.admin_economy_error()}</Banner>
{/if}

<section aria-labelledby="parametros">
	<h2 id="parametros">{m.admin_economy_parameters()}</h2>
	{#each data.settings as setting (setting.key)}
		<form method="POST" action="?/guardarParametro">
			<input type="hidden" name="clave" value={setting.key} />
			<TextField
				id={`valor-${setting.key}`}
				name="valor"
				label={setting.key}
				value={setting.value}
				required
			/>
			<TextField
				id={`motivo-${setting.key}`}
				name="motivo"
				label={m.admin_economy_reason()}
				required
			/>
			<Checkbox id={`confirmado-${setting.key}`} name="confirmado" value="true"
				>{m.admin_economy_confirm()}</Checkbox
			>
			<p><Button type="submit" variant="secondary">{m.admin_economy_save()}</Button></p>
		</form>
	{/each}
</section>

<section aria-labelledby="tipo-cambio">
	<h2 id="tipo-cambio">{m.admin_economy_fx()}</h2>
	<p>
		{m.admin_economy_fx_current()}: {data.fx.usdEurPpm} ppm · {data.fx.source}
	</p>
	<form method="POST" action="?/fijarTipoCambio">
		<TextField
			id="usdEurPpm"
			name="usdEurPpm"
			label={m.admin_economy_fx_ppm()}
			hint={m.admin_economy_fx_hint()}
			required
		/>
		<TextField id="motivo-fx" name="motivo" label={m.admin_economy_reason()} required />
		<Checkbox id="confirmado-fx" name="confirmado" value="true"
			>{m.admin_economy_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="primary">{m.admin_economy_fx_set()}</Button></p>
	</form>
	<form method="POST" action="?/quitarTipoCambio">
		<TextField id="motivo-quitar-fx" name="motivo" label={m.admin_economy_reason()} required />
		<Checkbox id="confirmado-quitar-fx" name="confirmado" value="true"
			>{m.admin_economy_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="secondary">{m.admin_economy_fx_clear()}</Button></p>
	</form>
</section>

<section aria-labelledby="precio-manual">
	<h2 id="precio-manual">{m.admin_economy_price()}</h2>
	<form method="POST" action="?/precioManual">
		<TextField id="operacion" name="operacion" label={m.admin_economy_operation()} required />
		<TextField
			id="microUsd"
			name="microUsd"
			label={m.admin_economy_micro_usd()}
			hint={m.admin_economy_micro_usd_hint()}
		/>
		<TextField id="motivo-precio" name="motivo" label={m.admin_economy_reason()} required />
		<Checkbox id="confirmado-precio" name="confirmado" value="true"
			>{m.admin_economy_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="primary">{m.admin_economy_price_save()}</Button></p>
	</form>
</section>
