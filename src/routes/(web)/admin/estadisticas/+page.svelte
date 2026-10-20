<script lang="ts">
	// W45 · `/admin/estadisticas`: estadísticas de un periodo con filtro GET (T319; BE-FR-54). Lo que no tiene datos se muestra como
	// «sin datos», nunca como cero. Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import ChartContainer from '$lib/components/ui/ChartContainer.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function euros(cents: number | null): string {
		return cents === null ? m.admin_stats_no_data() : formatEuros(cents);
	}
</script>

<svelte:head>
	<title>{m.admin_stats_title()}</title>
</svelte:head>

<h1>{m.admin_stats_title()}</h1>
<p>{m.admin_stats_intro()}</p>

<form method="GET" action={resolve('/admin/estadisticas')}>
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

{#if data.stats === null}
	<p>{m.admin_billing_no_period()}</p>
{:else}
	<section aria-labelledby="ingresos-costes">
		<h2 id="ingresos-costes">{m.admin_stats_money()}</h2>
		<dl>
			<dt>{m.admin_stats_revenue()}</dt>
			<dd>{euros(data.stats.revenueEurCents)}</dd>
			<dt>{m.admin_stats_cost()}</dt>
			<dd>{euros(data.stats.costEurCents)}</dd>
			<dt>{m.admin_stats_margin()}</dt>
			<dd>{euros(data.stats.marginEurCents)}</dd>
			<dt>{m.admin_stats_cancellation_cost()}</dt>
			<dd>{euros(data.stats.cancellationCostEurCents)}</dd>
			<dt>{m.admin_stats_real_purchases()}</dt>
			<dd>{data.stats.realPurchases}</dd>
			<dt>{m.admin_stats_simulated_purchases()}</dt>
			<dd>{data.stats.simulatedPurchases}</dd>
		</dl>
	</section>

	<section aria-labelledby="perdidas">
		<h2 id="perdidas">{m.admin_stats_losses()}</h2>
		<dl>
			<dt>{m.admin_stats_absorbed_debt()}</dt>
			<dd>{formatCredits(data.stats.absorbedDebtMicro)}</dd>
			<dt>{m.admin_stats_absorbed_replay()}</dt>
			<dd>{formatCredits(data.stats.absorbedReplayMicro)}</dd>
			<dt>{m.admin_stats_forfeited()}</dt>
			<dd>{formatCredits(data.stats.forfeitedMicro)}</dd>
		</dl>
	</section>

	<section aria-labelledby="embudo">
		<h2 id="embudo">{m.admin_stats_funnel()}</h2>
		<p>{m.admin_stats_downloads_pending()}</p>
		<ul>
			{#each data.stats.funnel as step (step.stage)}
				<li>{step.stage}: {step.count ?? m.admin_stats_no_data()}</li>
			{/each}
		</ul>
		<p>{m.admin_stats_active_users({ count: String(data.stats.activeUsers) })}</p>
	</section>

	<section aria-labelledby="serie-diaria">
		<h2 id="serie-diaria">{m.admin_stats_daily()}</h2>
		<ChartContainer
			title={m.admin_stats_chart_revenue()}
			period={`${data.desde} – ${data.hasta}`}
			unit={m.admin_stats_unit_euros()}
			validity={m.admin_stats_validity()}
			points={data.stats.days.map((day) => ({
				label: day.day,
				value: day.revenueEurCents === null ? null : day.revenueEurCents / 100
			}))}
		/>
		<ChartContainer
			title={m.admin_stats_chart_cost()}
			period={`${data.desde} – ${data.hasta}`}
			unit={m.admin_stats_unit_euros()}
			validity={m.admin_stats_validity()}
			points={data.stats.days.map((day) => ({
				label: day.day,
				value: day.costEurCents === null ? null : day.costEurCents / 100
			}))}
		/>
	</section>

	{#if data.stats.unconvertedOperations > 0}
		<p>{m.admin_billing_unconverted({ count: String(data.stats.unconvertedOperations) })}</p>
	{/if}
{/if}
