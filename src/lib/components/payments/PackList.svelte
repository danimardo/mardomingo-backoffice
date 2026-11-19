<script lang="ts">
	// Lista de paquetes a la venta (W20). Ninguno viene preseleccionado: cada uno es un enlace a su paso de confirmación.
	// Los créditos son la cifra principal; el precio con IVA, la bonificación y el precio por crédito la acompañan. Se destaca
	// solo el paquete de mayor bonificación (sin ella, ninguno). Debajo, las ventajas comunes a todos, una sola vez.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';
	import { bestPackId, formatCredits, formatEuros, formatCreditsPerEuro } from './format';

	interface Pack {
		readonly id: string;
		readonly name: string;
		readonly priceCents: number;
		readonly bonusPct: number;
		readonly creditsMicro: number;
	}

	let { packs }: { packs: readonly Pack[] } = $props();
	const best = $derived(bestPackId(packs));

	const perks: readonly { icon: IconName; text: string }[] = [
		{ icon: 'layers', text: m.payments_perk_apps() },
		{ icon: 'check', text: m.payments_perk_vat() },
		{ icon: 'receipt', text: m.payments_perk_invoice() },
		{ icon: 'history', text: m.payments_perk_history() }
	];
</script>

<p class="lead">{m.payments_lead()}</p>

<ul class="pack-list">
	{#each packs as pack (pack.id)}
		<li class="pack" class:best={pack.id === best} data-surface="glass">
			{#if pack.id === best}
				<p class="badge">{m.payments_pack_best()}</p>
			{/if}
			<div class="head">
				<h2>{pack.name}</h2>
				{#if pack.bonusPct > 0}
					<span class="bonus">{m.payments_pack_bonus_pill({ percent: String(pack.bonusPct) })}</span
					>
				{/if}
			</div>
			<p class="credits">
				<span class="amount">{formatCredits(pack.creditsMicro)}</span>
				<span class="unit">{m.payments_pack_unit()}</span>
			</p>
			<p class="price">
				<span class="euros">{formatEuros(pack.priceCents)}</span>
				<span class="vat">{m.payments_pack_price_vat()}</span>
			</p>
			<p class="rate">
				{m.payments_pack_rate({
					credits: formatCreditsPerEuro(pack.priceCents, pack.creditsMicro)
				})}
			</p>
			<div class="cta">
				<Button
					variant={pack.id === best ? 'primary' : 'secondary'}
					href="{resolve('/panel/comprar')}?paquete={pack.id}"
				>
					{m.payments_pack_select({ name: pack.name })}
				</Button>
			</div>
		</li>
	{/each}
</ul>

<section class="perks" aria-labelledby="perks-titulo">
	<h2 id="perks-titulo">{m.payments_perks_label()}</h2>
	<ul>
		{#each perks as perk (perk.text)}
			<li><Icon name={perk.icon} size={20} />{perk.text}</li>
		{/each}
	</ul>
</section>

<style>
	.lead {
		margin: 0 0 var(--space-10);
		max-width: 36rem;
		font-size: var(--font-size-lg);
		color: var(--color-text-secondary);
	}

	.pack-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		gap: var(--space-6) var(--space-5);
		align-items: stretch;
		margin: 0;
		padding: var(--space-4) 0 0;
		list-style: none;
	}

	/* Cristal sin anidar (principio XIII), con alternativa opaca si no hay backdrop-filter. */
	.pack {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-6) var(--space-6);
		background: var(--gradient-card-hero);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card-hero);
		backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
		-webkit-backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
		font-variant-numeric: tabular-nums;
	}

	@supports not (backdrop-filter: blur(1px)) {
		.pack {
			background: var(--surface-solid-card);
		}
	}

	.pack.best {
		border: 2px solid var(--color-accent);
		box-shadow: var(--shadow-card-selected), var(--shadow-card-hero);
	}

	.badge {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border-radius: 999px;
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-control);
		white-space: nowrap;
	}

	/* Altura fija de la cabecera: con o sin píldora, las cifras de todas las tarjetas quedan a la misma altura. */
	.head {
		min-height: var(--space-8);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}

	.bonus {
		padding: var(--space-1) var(--space-3);
		border-radius: 999px;
		background: var(--color-success-soft);
		color: var(--text-success);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-control);
	}

	.credits {
		display: flex;
		flex-direction: column;
		margin: var(--space-4) 0 0;
	}

	.amount {
		font-size: clamp(2.5rem, 6vw, 3.25rem);
		font-weight: var(--font-weight-title);
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--color-text-primary);
	}

	.unit {
		margin-top: var(--space-1);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.price {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: var(--space-4) 0 0;
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
	}

	.euros {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-title);
		color: var(--color-text-primary);
	}

	.vat,
	.rate {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.rate {
		margin: 0;
	}

	.cta {
		display: grid;
		margin-top: auto;
		padding-top: var(--space-6);
	}

	.perks {
		margin-top: var(--space-12);
		padding: var(--space-6);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
	}

	.perks h2 {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-sm);
	}

	.perks ul {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		gap: var(--space-3) var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.perks li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
		color: var(--color-text-primary);
	}

	.perks li :global(svg) {
		flex: none;
		color: var(--color-accent);
	}
</style>
