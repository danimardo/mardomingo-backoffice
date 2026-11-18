<script lang="ts">
	// W38 · `/admin/economia`: parámetros económicos globales, tipo de cambio manual y precio orientativo manual (T309; BE-FR-61,
	// BE-FR-73, BE-FR-87). Cada cambio pide motivo y confirmación, y al guardar enlaza con su entrada de auditoría (UX-13). El tipo
	// manual se previsualiza («antes → después») antes de confirmarlo (C-48). Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import { resolve } from '$app/paths';
	import { REASON_MAX_LENGTH, reasonFieldOf } from '$lib/schemas/common/reason';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errors = $derived<Readonly<Record<string, string>>>(form?.errors ?? {});
	const values = $derived<Readonly<Record<string, string>>>(form?.values ?? {});
</script>

<svelte:head>
	<title>{m.admin_economy_title()}</title>
</svelte:head>

<h1>{m.admin_economy_title()}</h1>
<p>{m.admin_economy_intro()}</p>
{#if data.saved !== null}
	<p role="status">
		{m.admin_notice_saved()}
		<a href="{resolve('/admin/auditoria')}/{encodeURIComponent(data.saved)}"
			>{m.admin_notice_audit_link()}</a
		>
	</p>
{/if}

{#if form?.formError}
	<Banner level="critical">{m.admin_economy_error()}</Banner>
{/if}

<section aria-labelledby="parametros">
	<h2 id="parametros">{m.admin_economy_parameters()}</h2>
	{#each data.settings as setting (setting.key)}
		<form method="POST" action="?/guardarParametros">
			<input type="hidden" name="clave" value={setting.key} />
			<TextField
				id={`valor-${setting.key}`}
				name="valor"
				label={setting.key}
				value={setting.value}
				required
			/>
			<p>
				{m.admin_economy_default_label()}: {setting.defaultValue} · {m.admin_economy_scope_global()}
			</p>
			<p>{setting.explanation}</p>
			<TextField
				id={`motivo-${setting.key}`}
				name="motivo"
				label={m.admin_economy_reason()}
				required
				maxlength={REASON_MAX_LENGTH}
				{...reasonFieldOf(form, `guardarParametros:${setting.key}`)}
			/>
			<Checkbox id={`confirmado-${setting.key}`} name="confirmado" value="true"
				>{m.admin_economy_confirm()}</Checkbox
			>
			<p>
				<Button type="submit" formaction="?/previsualizarParametros" variant="secondary"
					>{m.admin_economy_preview()}</Button
				>
			</p>
		</form>
	{/each}

	{#if form?.preview}
		<section aria-labelledby="vista-previa">
			<h3 id="vista-previa">{m.admin_economy_preview_title()}</h3>
			{#if form.preview.valid}
				<p>
					{form.preview.key}: {form.preview.before ?? ''} → {form.preview.after ?? ''} ({m.admin_economy_scope_global()})
				</p>
				<form method="POST" action="?/guardarParametros">
					<input type="hidden" name="clave" value={form.preview.key} />
					<input type="hidden" name="valor" value={form.preview.after ?? ''} />
					<TextField
						id="motivo-vista-previa"
						name="motivo"
						label={m.admin_economy_reason()}
						required
						maxlength={REASON_MAX_LENGTH}
					/>
					<Checkbox id="confirmado-vista-previa" name="confirmado" value="true"
						>{m.admin_economy_confirm()}</Checkbox
					>
					<p><Button type="submit" variant="primary">{m.admin_economy_save()}</Button></p>
				</form>
			{:else}
				<Banner level="critical">{m.admin_economy_preview_invalid()}</Banner>
			{/if}
		</section>
	{/if}
</section>

<section aria-labelledby="paquetes">
	<h2 id="paquetes">{m.admin_economy_packs()}</h2>
	<p>{m.admin_economy_packs_hint()}</p>
	<table>
		<thead>
			<tr>
				<th scope="col">{m.admin_economy_pack_name()}</th>
				<th scope="col">{m.admin_economy_pack_price()}</th>
				<th scope="col">{m.admin_economy_pack_bonus()}</th>
				<th scope="col">{m.admin_economy_pack_active()}</th>
			</tr>
		</thead>
		<tbody>
			{#each data.packs as pack (pack.id)}
				<tr>
					<td>{pack.name}</td>
					<td>{pack.priceEurCents / 100} €</td>
					<td>{pack.bonusPpm / 10000} %</td>
					<td>{pack.active ? m.admin_economy_yes() : m.admin_economy_no()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section aria-labelledby="tipo-cambio">
	<h2 id="tipo-cambio">{m.admin_economy_fx()}</h2>
	<p>
		{m.admin_economy_fx_current()}: {data.fx.usdEurPpm} ppm · {data.fx.source}
	</p>
	<form method="POST" action="?/previsualizarTipoCambioManual">
		<TextField
			id="usdEurPpm"
			name="usdEurPpm"
			label={m.admin_economy_fx_ppm()}
			hint={m.admin_economy_fx_hint()}
			value={values.usdEurPpm ?? ''}
			error={errors.usdEurPpm === 'fx_out_of_range' ? m.admin_economy_fx_out_of_range() : ''}
			required
		/>
		<TextField
			id="motivo-fx"
			name="motivo"
			label={m.admin_economy_reason()}
			required
			maxlength={REASON_MAX_LENGTH}
			{...reasonFieldOf(form, 'tipoCambioManual')}
		/>
		<p><Button type="submit" variant="secondary">{m.admin_economy_preview()}</Button></p>
	</form>
	{#if form?.fxPreview}
		<section aria-labelledby="vista-previa-fx">
			<h3 id="vista-previa-fx">{m.admin_economy_fx_preview_title()}</h3>
			<p>
				{m.admin_economy_fx_preview_change({
					beforePpm: String(form.fxPreview.beforePpm),
					beforeEur: form.fxPreview.beforeEur,
					afterPpm: String(form.fxPreview.afterPpm),
					afterEur: form.fxPreview.afterEur
				})}
			</p>
			<form method="POST" action="?/fijarTipoCambioManual">
				<input type="hidden" name="usdEurPpm" value={form.fxPreview.afterPpm} />
				<TextField
					id="motivo-fx-confirmar"
					name="motivo"
					label={m.admin_economy_reason()}
					value={form.fxPreview.reason}
					required
					maxlength={REASON_MAX_LENGTH}
				/>
				<Checkbox id="confirmado-fx" name="confirmado" value="true"
					>{m.admin_economy_confirm()}</Checkbox
				>
				<p><Button type="submit" variant="primary">{m.admin_economy_fx_set()}</Button></p>
			</form>
		</section>
	{/if}
	<form method="POST" action="?/quitarTipoCambioManual">
		<TextField
			id="motivo-quitar-fx"
			name="motivo"
			label={m.admin_economy_reason()}
			required
			maxlength={REASON_MAX_LENGTH}
			{...reasonFieldOf(form, 'quitarTipoCambioManual')}
		/>
		<Checkbox id="confirmado-quitar-fx" name="confirmado" value="true"
			>{m.admin_economy_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="secondary">{m.admin_economy_fx_clear()}</Button></p>
	</form>
</section>

<section aria-labelledby="precio-manual">
	<h2 id="precio-manual">{m.admin_economy_price()}</h2>
	<form method="POST" action="?/guardarPrecioOrientativo">
		<TextField
			id="operacion"
			name="operacion"
			label={m.admin_economy_operation()}
			value={form?.scope === 'guardarPrecioOrientativo' ? (values.operacion ?? '') : ''}
			required
		/>
		<TextField
			id="microUsd"
			name="microUsd"
			label={m.admin_economy_micro_usd()}
			hint={m.admin_economy_micro_usd_hint()}
			value={form?.scope === 'guardarPrecioOrientativo' ? (values.microUsd ?? '') : ''}
		/>
		<TextField
			id="motivo-precio"
			name="motivo"
			label={m.admin_economy_reason()}
			required
			maxlength={REASON_MAX_LENGTH}
			{...reasonFieldOf(form, 'guardarPrecioOrientativo')}
		/>
		<Checkbox id="confirmado-precio" name="confirmado" value="true"
			>{m.admin_economy_confirm()}</Checkbox
		>
		<p><Button type="submit" variant="primary">{m.admin_economy_price_save()}</Button></p>
	</form>
</section>
