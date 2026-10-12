<script lang="ts">
	// Lista de paquetes a la venta (W20). Ninguno viene preseleccionado: cada uno es un enlace a su paso de confirmación.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatCredits, formatEuros } from './format';

	interface Pack {
		readonly id: string;
		readonly name: string;
		readonly priceCents: number;
		readonly bonusPct: number;
		readonly creditsMicro: number;
	}

	let { packs }: { packs: readonly Pack[] } = $props();
</script>

<ul class="pack-list">
	{#each packs as pack (pack.id)}
		<li class="pack">
			<h2>{pack.name}</h2>
			<p class="figures">
				<span>{formatEuros(pack.priceCents)}</span>
				<span>{m.payments_pack_credits({ credits: formatCredits(pack.creditsMicro) })}</span>
				{#if pack.bonusPct > 0}
					<span>{m.payments_pack_bonus({ percent: String(pack.bonusPct) })}</span>
				{/if}
			</p>
			<Button variant="primary" href="{resolve('/panel/comprar')}?paquete={pack.id}">
				{m.payments_pack_select({ name: pack.name })}
			</Button>
		</li>
	{/each}
</ul>

<style>
	.pack-list {
		display: grid;
		gap: 1rem;
		list-style: none;
		padding: 0;
	}
	.figures {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		font-variant-numeric: tabular-nums;
	}
</style>
