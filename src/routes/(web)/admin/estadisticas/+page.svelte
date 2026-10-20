<script lang="ts">
	// W45 · `/admin/estadisticas`: estadísticas de un periodo con filtro GET (T319; BE-FR-54). Lo que no tiene datos se muestra como
	// «sin datos», nunca como cero. Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import ChartContainer from '$lib/components/ui/ChartContainer.svelte';
	import Select from '$lib/components/ui/Select.svelte';
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
	<TextField id="app" name="app" label={m.admin_stats_app_filter()} value={data.app} />
	<TextField
		id="operacion"
		name="operacion"
		label={m.admin_stats_operation_filter()}
		value={data.operacion}
	/>
	<Select
		id="agrupacion"
		name="agrupacion"
		label={m.admin_stats_grouping()}
		value={data.agrupacion}
		options={[
			{ value: 'dia', label: m.admin_stats_group_day() },
			{ value: 'app', label: m.admin_stats_group_app() },
			{ value: 'operacion', label: m.admin_stats_group_operation() },
			{ value: 'usuario', label: m.admin_stats_group_user() }
		]}
	/>
	<Select
		id="embudo"
		name="embudo"
		label={m.admin_stats_funnel_mode()}
		value={data.embudo}
		options={[
			{ value: 'semanal', label: m.admin_stats_funnel_weekly() },
			{ value: 'acumulado', label: m.admin_stats_funnel_cumulative() }
		]}
	/>
	<p>{m.admin_stats_filter_note()}</p>
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

	<section aria-labelledby="embudo-semanas">
		<h2 id="embudo-semanas">{m.admin_stats_funnel_weeks_heading()}</h2>
		<table>
			<thead>
				<tr>
					<th scope="col">{m.admin_stats_week()}</th>
					<th scope="col">{m.admin_stats_stage_downloads()}</th>
					<th scope="col">{m.admin_stats_stage_signups()}</th>
					<th scope="col">{m.admin_stats_stage_verified()}</th>
					<th scope="col">{m.admin_stats_stage_first_login()}</th>
					<th scope="col">{m.admin_stats_stage_first_operation()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stats.funnelWeeks as row (row.week)}
					<tr>
						<th scope="row">{row.week}</th>
						<td>{row.counts.descargas ?? m.admin_stats_no_data()}</td>
						<td>{row.counts.altas ?? m.admin_stats_no_data()}</td>
						<td>{row.counts.verificadas ?? m.admin_stats_no_data()}</td>
						<td>{row.counts.primer_login ?? m.admin_stats_no_data()}</td>
						<td>{row.counts.primera_operacion ?? m.admin_stats_no_data()}</td>
					</tr>
				{:else}
					<tr><td colspan="6">{m.admin_stats_no_data()}</td></tr>
				{/each}
			</tbody>
		</table>
	</section>

	{#if data.stats.groups.length > 0}
		<section aria-labelledby="por-grupo">
			<h2 id="por-grupo">{m.admin_stats_groups_heading()}</h2>
			<table>
				<thead>
					<tr>
						<th scope="col">{m.admin_stats_group_key()}</th>
						<th scope="col">{m.admin_stats_group_operations()}</th>
						<th scope="col">{m.admin_stats_group_cost()}</th>
						<th scope="col">{m.admin_stats_group_unconverted()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.stats.groups as group (group.key)}
						<tr>
							<th scope="row">{group.key}</th>
							<td>{group.operations}</td>
							<td>{euros(group.costEurCents)}</td>
							<td>{group.unconverted}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

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
