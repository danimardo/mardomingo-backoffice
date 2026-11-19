<script lang="ts">
	// Paso de confirmación de la compra (W20): paquete, precio con IVA incluido, renuncia al desistimiento sin premarcar,
	// factura completa opcional y envío único (`aria-busy` mientras se procesa, sin doble envío). En escritorio, el resumen
	// del paquete a un lado y el formulario al otro; en móvil, el resumen arriba.
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import Notice from '$lib/components/ui/Notice.svelte';
	import BillingFields from './BillingFields.svelte';
	import { bonusCreditsMicro, formatCredits, formatEuros, formatCreditsPerEuro } from './format';

	interface Pack {
		readonly id: string;
		readonly name: string;
		readonly priceCents: number;
		readonly creditsMicro: number;
		readonly bonusPct?: number;
	}

	let {
		pack,
		intentId,
		waiverVersion,
		billing,
		errors = {},
		formError = ''
	}: {
		pack: Pack;
		intentId: string;
		waiverVersion: string | null;
		billing: { values?: Record<string, string | undefined> };
		errors?: Readonly<Record<string, string>>;
		formError?: string;
	} = $props();

	let wantsFullInvoice = $state(false);
	const billingErrored = $derived(Object.keys(errors).some((key) => key !== 'waiverAccepted'));
	let submitting = $state(false);
	const bonusPct = $derived(pack.bonusPct ?? 0);
	const bonusMicro = $derived(bonusCreditsMicro(pack.creditsMicro, bonusPct));
</script>

<div class="layout">
	<section class="summary" aria-labelledby="resumen-titulo" data-surface="glass">
		<p class="eyebrow">{m.payments_selected_label()}</p>
		<div class="head">
			<h2 id="resumen-titulo">{pack.name}</h2>
			{#if bonusPct > 0}
				<span class="bonus">{m.payments_pack_bonus_pill({ percent: String(bonusPct) })}</span>
			{/if}
		</div>
		<p class="credits">
			<span class="amount">{formatCredits(pack.creditsMicro)}</span>
			<span class="unit">{m.payments_pack_unit()}</span>
		</p>

		<dl class="rows">
			<div>
				<dt>{m.payments_summary_credits()}</dt>
				<dd>{m.payments_pack_credits({ credits: formatCredits(pack.creditsMicro) })}</dd>
			</div>
			{#if bonusMicro > 0}
				<div class="gift">
					<dt>{m.payments_summary_bonus()}</dt>
					<dd>+{m.payments_pack_credits({ credits: formatCredits(bonusMicro) })}</dd>
				</div>
			{/if}
			<div>
				<dt>{m.payments_summary_rate()}</dt>
				<dd>{formatCreditsPerEuro(pack.priceCents, pack.creditsMicro)}</dd>
			</div>
			<div class="total">
				<dt>{m.payments_summary_total()}</dt>
				<dd>{formatEuros(pack.priceCents)}</dd>
			</div>
		</dl>
		<p class="vat">{m.payments_vat_included()}</p>
		<p class="change">
			<a href={resolve('/panel/comprar')}>{m.payments_back_to_packs()}</a>
		</p>
	</section>

	<form
		class="confirm"
		method="POST"
		action="?/comprar&paquete={pack.id}"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<input type="hidden" name="packId" value={pack.id} />
		<input type="hidden" name="intentId" value={intentId} />
		<input type="hidden" name="waiverVersion" value={waiverVersion ?? ''} />

		<h2>{m.payments_confirm_title()}</h2>

		{#if formError}
			<Notice tone="danger">
				<p>{m.payments_error_form({ code: formError })}</p>
			</Notice>
		{/if}

		<Checkbox id="waiver-accepted" name="waiverAccepted" error={errors.waiverAccepted ?? ''}>
			{m.payments_waiver_label()}
		</Checkbox>

		<Checkbox id="want-full-invoice" name="wantsFullInvoice" bind:checked={wantsFullInvoice}>
			{m.payments_full_invoice_label()}
		</Checkbox>

		<!-- Sin JavaScript el bloque queda plegado, pero sus campos se envían igual: se puede abrir a mano. -->
		<details open={wantsFullInvoice || billingErrored}>
			<summary>{m.payments_billing_summary()}</summary>
			<BillingFields values={billing.values ?? {}} {errors} />
		</details>

		<div class="cta">
			<Button type="submit" variant="primary" busy={submitting} disabled={submitting}>
				{m.payments_submit({ price: formatEuros(pack.priceCents) })}
			</Button>
		</div>
	</form>
</div>

<style>
	.layout {
		display: grid;
		gap: var(--space-8);
		align-items: start;
	}

	@media (min-width: 52rem) {
		.layout {
			grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
		}

		.summary {
			position: sticky;
			top: var(--space-24);
		}
	}

	/* Cristal sin anidar (principio XIII), con alternativa opaca si no hay backdrop-filter. */
	.summary {
		display: flex;
		flex-direction: column;
		padding: var(--space-8) var(--space-6) var(--space-6);
		background: var(--gradient-card-hero);
		border: 2px solid var(--color-accent);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card-selected), var(--shadow-card-hero);
		backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
		-webkit-backdrop-filter: blur(var(--blur-card)) saturate(var(--material-saturate));
		font-variant-numeric: tabular-nums;
	}

	@supports not (backdrop-filter: blur(1px)) {
		.summary {
			background: var(--surface-solid-card);
		}
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-control);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.summary h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-title);
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
		margin: var(--space-4) 0 var(--space-6);
	}

	.amount {
		font-size: clamp(2.5rem, 6vw, 3.25rem);
		font-weight: var(--font-weight-title);
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.unit {
		margin-top: var(--space-1);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.rows {
		display: grid;
		gap: var(--space-2);
		margin: 0;
	}

	.rows div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		font-size: var(--font-size-sm);
	}

	.rows dt {
		color: var(--color-text-secondary);
	}

	.rows dd {
		margin: 0;
		text-align: right;
	}

	.rows .gift dd {
		color: var(--text-success);
		font-weight: var(--font-weight-control);
	}

	.rows .total {
		align-items: baseline;
		margin-top: var(--space-2);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border-subtle);
	}

	.rows .total dt {
		color: var(--color-text-primary);
		font-weight: var(--font-weight-control);
	}

	.rows .total dd {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-title);
	}

	.vat {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
		text-align: right;
	}

	.change {
		margin: var(--space-6) 0 0;
		font-size: var(--font-size-sm);
	}

	.change a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}

	.confirm {
		display: grid;
		gap: var(--space-5);
		padding: var(--space-8) var(--space-6);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-solid-card);
	}

	.confirm h2 {
		margin: 0;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-title);
	}

	details summary {
		padding-block: var(--space-3);
		cursor: pointer;
		font-weight: var(--font-weight-control);
	}

	.cta {
		display: grid;
		padding-top: var(--space-2);
	}
</style>
