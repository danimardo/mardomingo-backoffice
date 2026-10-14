<script lang="ts">
	// `/panel` (W18): saldo y desglose, bolsas con su caducidad, bienvenida, aviso de saldo bajo, documentos pendientes y soporte.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import BalanceCard from '$lib/components/credits/BalanceCard.svelte';
	import AnnouncementsBanner from '$lib/components/notifications/AnnouncementsBanner.svelte';
	import { formatCredits } from '$lib/components/payments/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function documentLabel(document: string): string {
		switch (document) {
			case 'terms':
				return m.panel_doc_terms();
			case 'privacy':
				return m.panel_doc_privacy();
			default:
				return m.panel_doc_aup();
		}
	}

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

<section>
	<BalanceCard
		totalMicro={data.balance.totalMicro}
		reservedMicro={data.balance.reservedMicro}
		availableMicro={data.balance.availableMicro}
		debtMicro={data.balance.debtMicro}
		eurCents={data.balance.eurCents}
	/>
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

<AnnouncementsBanner items={data.announcements} />

{#if data.pendingAcceptances.length > 0}
	<section aria-labelledby="pendientes-titulo">
		<h2 id="pendientes-titulo">{m.panel_pending_documents()}</h2>
		<p>{m.panel_pending_effect()}</p>
		{#if form?.errors.documents}
			<Banner level="critical">{m.panel_pending_error()}</Banner>
		{/if}
		<form method="POST" action="?/aceptarDocumentos">
			<fieldset>
				<legend>{m.panel_pending_choose()}</legend>
				{#each data.pendingAcceptances as item (item.document)}
					<label class="casilla">
						<input type="checkbox" name="documents" value={`${item.document}:${item.version}`} />
						<span>{documentLabel(item.document)}</span>
					</label>
				{/each}
			</fieldset>
			<p><Button type="submit" variant="primary">{m.panel_pending_accept()}</Button></p>
		</form>
	</section>
{/if}

<p>{m.panel_support({ email: data.supportEmail })}</p>

<style>
</style>
