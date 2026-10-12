<script lang="ts">
	// W20 · `/panel/comprar`: lista de paquetes o paso de confirmación; «Próximamente» si la compra no está disponible (UX-06).
	import * as m from '$lib/paraglide/messages.js';
	import ComingSoonNotice from '$lib/components/payments/ComingSoonNotice.svelte';
	import PackList from '$lib/components/payments/PackList.svelte';
	import PurchaseStep from '$lib/components/payments/PurchaseStep.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
	const formError = $derived(form?.formError ?? '');
</script>

<svelte:head>
	<title>{m.payments_title()}</title>
</svelte:head>

<h1>{m.payments_title()}</h1>

{#if !data.availability.canPurchase}
	<ComingSoonNotice />
{:else if data.selected !== null && data.intentId !== null}
	<PurchaseStep
		pack={data.selected}
		intentId={data.intentId}
		waiverVersion={data.waiverText.version}
		billing={data.billingProfile}
		{errors}
		{formError}
	/>
{:else}
	<PackList packs={data.packs} />
{/if}
