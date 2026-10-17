<script lang="ts">
	// Saldo del panel (W18; T261; BE-FR-49.1). Superficie opaca: el cristal queda reservado a las zonas del principio XIII.
	import * as m from '$lib/paraglide/messages.js';
	import { formatCredits, formatEuros } from '$lib/components/payments/format';

	interface Props {
		readonly totalMicro: number;
		readonly reservedMicro: number;
		readonly availableMicro: number;
		readonly debtMicro: number;
		readonly eurCents: number | null;
	}

	let { totalMicro, reservedMicro, availableMicro, debtMicro, eurCents }: Props = $props();
</script>

<section class="balance-card" aria-labelledby="saldo-titulo">
	<h2 id="saldo-titulo">{m.panel_balance_heading()}</h2>
	<dl class="balance">
		<dt>{m.panel_balance_total()}</dt>
		<dd>{formatCredits(totalMicro)}</dd>
		<dt>{m.panel_balance_reserved()}</dt>
		<dd>{formatCredits(reservedMicro)}</dd>
		<dt>{m.panel_balance_eur()}</dt>
		<dd>{eurCents === null ? m.panel_balance_eur_unavailable() : formatEuros(eurCents)}</dd>
		<dt>{m.panel_balance_available()}</dt>
		<dd>{formatCredits(availableMicro)}</dd>
		{#if debtMicro > 0}
			<dt>{m.panel_balance_debt()}</dt>
			<dd>{formatCredits(debtMicro)}</dd>
		{/if}
	</dl>
</section>

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
