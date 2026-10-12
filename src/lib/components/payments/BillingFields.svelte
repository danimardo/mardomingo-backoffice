<script lang="ts">
	// Datos fiscales de la factura completa (BE-FR-74). Sin JavaScript se rellenan y envían igual: son campos normales del
	// formulario, con su error junto al campo.
	import * as m from '$lib/paraglide/messages.js';
	import TextField from '$lib/components/ui/TextField.svelte';

	type Values = Readonly<Record<string, string | undefined>>;

	let { values = {}, errors = {} }: { values?: Values; errors?: Readonly<Record<string, string>> } =
		$props();
</script>

<fieldset class="billing">
	<legend>{m.payments_billing_heading()}</legend>
	<p class="hint" id="billing-hint">{m.payments_billing_hint()}</p>
	<div class="field">
		<label for="billing-kind">{m.payments_billing_kind_label()}</label>
		<select id="billing-kind" name="billingKind" aria-describedby="billing-hint">
			<option value="individual" selected={values.kind !== 'business'}>
				{m.payments_billing_individual()}
			</option>
			<option value="business" selected={values.kind === 'business'}>
				{m.payments_billing_business()}
			</option>
		</select>
	</div>
	<TextField
		id="billing-legal-name"
		name="legalName"
		label={m.payments_legal_name_label()}
		value={values.legalName ?? ''}
		autocomplete="name"
		error={errors.legalName ?? ''}
	/>
	<TextField
		id="billing-tax-id"
		name="taxId"
		label={m.payments_tax_id_label()}
		value={values.taxId ?? ''}
		error={errors.taxId ?? ''}
	/>
	<TextField
		id="billing-address"
		name="address"
		label={m.payments_address_label()}
		value={values.address ?? ''}
		autocomplete="street-address"
		error={errors.address ?? ''}
	/>
	<TextField
		id="billing-postal-code"
		name="postalCode"
		label={m.payments_postal_code_label()}
		value={values.postalCode ?? ''}
		autocomplete="postal-code"
		error={errors.postalCode ?? ''}
	/>
	<TextField
		id="billing-city"
		name="city"
		label={m.payments_city_label()}
		value={values.city ?? ''}
		autocomplete="address-level2"
		error={errors.city ?? ''}
	/>
	<TextField
		id="billing-country"
		name="country"
		label={m.payments_country_label()}
		value={values.country ?? 'ES'}
		autocomplete="country"
		error={errors.country ?? ''}
	/>
</fieldset>

<style>
	.billing {
		display: grid;
		gap: 0.75rem;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 1rem;
	}
	.hint {
		color: var(--color-text-secondary);
	}
	select {
		min-height: 44px;
	}
</style>
