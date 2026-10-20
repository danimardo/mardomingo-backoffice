<script lang="ts">
	// W03 · Precios orientativos (T350; BE-FR-73). El coste típico es la mediana de los cobros recientes, o un valor del
	// administrador mientras no hay muestras. La página avisa de que el cobro real depende de la longitud del texto o del audio
	// y del modelo vigente. Una app sin precios todavía lo explica en lugar de dejar la tabla vacía.
	import { resolve } from '$app/paths';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import { formatCredits } from '$lib/format/credits';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const columns = [
		{ key: 'operation', label: m.prices_col_operation(), align: 'start' as const },
		{ key: 'typical', label: m.prices_col_typical(), align: 'end' as const },
		{ key: 'source', label: m.prices_col_source(), align: 'start' as const }
	];

	function rowsOf(operations: PageData['groups'][number]['operations']): string[][] {
		return operations.map((operation) => [
			operation.name,
			operation.typicalMicro === null ? m.prices_no_data() : formatCredits(operation.typicalMicro),
			operation.source === 'manual'
				? m.prices_source_manual()
				: operation.source === 'auto'
					? m.prices_source_auto()
					: '—'
		]);
	}

	const minuteExample = $derived(
		data.examples.dictationMinuteMicro === null
			? null
			: formatCredits(data.examples.dictationMinuteMicro)
	);
	const hoursExample = $derived(
		data.examples.hoursPerPack5EurTenths === null
			? null
			: new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(
					data.examples.hoursPerPack5EurTenths / 10
				)
	);
</script>

<svelte:head>
	<title>{m.prices_title()}</title>
</svelte:head>

<h1>{m.prices_title()}</h1>
<p>{m.prices_intro()}</p>

<Notice tone="info"><p>{m.prices_warning()}</p></Notice>

{#if minuteExample !== null}
	<section aria-labelledby="ejemplos-titulo">
		<h2 id="ejemplos-titulo">{m.prices_examples_title()}</h2>
		<ul>
			<li>{m.prices_example_minute({ credits: minuteExample })}</li>
			{#if hoursExample !== null}
				<li>{m.prices_example_pack({ hours: hoursExample })}</li>
			{/if}
		</ul>
	</section>
{/if}

{#if data.groups.length === 0}
	<p>{m.prices_empty()}</p>
{:else}
	{#each data.groups as group, index (group.appName)}
		<section aria-labelledby={`app-${String(index)}`}>
			<h2 id={`app-${String(index)}`}>{group.appName}</h2>
			{#if group.operations.every((operation) => operation.typicalMicro === null)}
				<p>{m.prices_app_empty({ name: group.appName })}</p>
			{:else}
				<DataTable
					caption={m.prices_caption({ name: group.appName })}
					{columns}
					rows={rowsOf(group.operations)}
				/>
			{/if}
		</section>
	{/each}
{/if}

{#if data.computedOn !== null}
	<p>{m.prices_computed({ date: data.computedOn })}</p>
{/if}

<p><a href={resolve('/registro')}>{m.layout_nav_register()}</a></p>
