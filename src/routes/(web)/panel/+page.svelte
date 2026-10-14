<script lang="ts">
	// `/panel` (W18): saldo y desglose, bolsas con su caducidad, bienvenida, aviso de saldo bajo, documentos pendientes y soporte.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const bucketRows = $derived(
		data.buckets.map((bucket) => [
			bucket.kind === 'free' ? m.panel_bucket_free() : m.panel_bucket_paid(),
			formatCredits(bucket.remainingMicro),
			bucket.expiresOn ?? m.panel_bucket_no_expiry(),
			bucket.simulated ? m.panel_bucket_simulated() : ''
		])
	);
	const bucketColumns = [
		{ key: 'kind', label: m.panel_bucket_col_kind(), align: 'start' as const },
		{ key: 'credits', label: m.panel_bucket_col_credits(), align: 'end' as const },
		{ key: 'expires', label: m.panel_bucket_col_expires(), align: 'start' as const },
		{ key: 'simulated', label: m.panel_bucket_col_mode(), align: 'start' as const }
	];
</script>

<svelte:head>
	<title>{m.panel_title()}</title>
</svelte:head>

<h1>{m.panel_title()}</h1>
<p>{m.panel_signed_as({ email: data.email })}</p>
<p><a href={resolve('/logout')}>{m.accounts_logout_action()}</a></p>

<section aria-labelledby="saldo-titulo">
	<h2 id="saldo-titulo">{m.panel_balance_heading()}</h2>
	<dl class="balance">
		<dt>{m.panel_balance_total()}</dt>
		<dd>{formatCredits(data.balance.totalMicro)}</dd>
		<dt>{m.panel_balance_reserved()}</dt>
		<dd>{formatCredits(data.balance.reservedMicro)}</dd>
		<dt>{m.panel_balance_eur()}</dt>
		<dd>
			{data.balance.eurCents === null
				? m.panel_balance_eur_unavailable()
				: formatEuros(data.balance.eurCents)}
		</dd>
		<dt>{m.panel_balance_available()}</dt>
		<dd>{formatCredits(data.balance.availableMicro)}</dd>
		{#if data.balance.debtMicro > 0}
			<dt>{m.panel_balance_debt()}</dt>
			<dd>{formatCredits(data.balance.debtMicro)}</dd>
		{/if}
	</dl>
	{#if data.welcome.status === 'none'}
		<p>{m.panel_welcome_none()}</p>
	{/if}
	{#if data.lowBalance.isBelow}
		<Banner level="warning">{m.panel_low_balance()}</Banner>
	{/if}
	{#if data.buckets.length === 0}
		<p>{m.panel_buckets_empty()}</p>
	{:else}
		<DataTable caption={m.panel_buckets_caption()} columns={bucketColumns} rows={bucketRows} />
	{/if}
</section>

{#each data.announcements as item (item.id)}
	<Banner level={item.level}>
		{#if item.appName !== null}{item.appName}:
		{/if}{item.message}
	</Banner>
{/each}

{#if data.pendingAcceptances.length > 0}
	<Banner level="info">{m.panel_pending_documents()}</Banner>
{/if}

<p>{m.panel_support({ email: data.supportEmail })}</p>

<style>
	.balance {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.4rem 1rem;
		font-variant-numeric: tabular-nums;
	}
	.balance dd {
		margin: 0;
	}
</style>
