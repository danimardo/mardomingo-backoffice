<script lang="ts">
	// W50 · `/admin/facturacion`: informe contable del periodo con filtro GET y descargas (T316; BE-FR-76). Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const query = $derived(
		`desde=${encodeURIComponent(data.desde)}&hasta=${encodeURIComponent(data.hasta)}`
	);
</script>

<svelte:head>
	<title>{m.admin_billing_title()}</title>
</svelte:head>

<h1>{m.admin_billing_title()}</h1>
<p>{m.admin_billing_intro()}</p>

<form method="GET" action={resolve('/admin/facturacion')}>
	<TextField
		id="desde"
		name="desde"
		label={m.admin_billing_from()}
		value={data.desde}
		hint="AAAA-MM-DD"
	/>
	<TextField
		id="hasta"
		name="hasta"
		label={m.admin_billing_to()}
		value={data.hasta}
		hint="AAAA-MM-DD"
	/>
	<p><Button type="submit" variant="primary">{m.admin_billing_filter()}</Button></p>
</form>

{#if !data.period}
	<p>{m.admin_billing_no_period()}</p>
{:else}
	<p>{m.admin_billing_sales({ count: String(data.sales) })}</p>
	{#if data.unconverted > 0}
		<p>{m.admin_billing_unconverted({ count: String(data.unconverted) })}</p>
	{/if}
	<ul>
		<li>
			<a href={resolve(`/admin/facturacion/exportar?archivo=ventas&${query}`)}
				>{m.admin_billing_download_sales()}</a
			>
		</li>
		<li>
			<a href={resolve(`/admin/facturacion/exportar?archivo=mensual&${query}`)}
				>{m.admin_billing_download_monthly()}</a
			>
		</li>
		<li>
			<a href={resolve(`/admin/facturacion/exportar?archivo=ia&${query}`)}
				>{m.admin_billing_download_ai()}</a
			>
		</li>
	</ul>
{/if}
