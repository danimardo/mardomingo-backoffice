<script lang="ts">
	// W35 · `/admin/usuarios/[userId]`: ficha de la cuenta y sus acciones con confirmación (T306; BE-FR-50, BE-FR-18). Cada acción
	// destructiva se confirma con una casilla aparte y el motivo es obligatorio. Sin JavaScript funciona igual.
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatCredits } from '$lib/components/payments/format';
	import { resolve } from '$app/paths';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const errorText = $derived(form?.formError ? m.admin_users_error() : '');
</script>

<svelte:head>
	<title>{m.admin_users_account_title()}</title>
</svelte:head>

<h1>{m.admin_users_account_title()}</h1>
<p>{data.account.email} · {data.account.role}</p>
<section aria-labelledby="saldo-cuenta">
	<h2 id="saldo-cuenta">{m.admin_account_balance_heading()}</h2>
	<dl>
		<dt>{m.admin_account_balance_total()}</dt>
		<dd>{formatCredits(data.balance.totalMicro)}</dd>
		<dt>{m.admin_account_balance_available()}</dt>
		<dd>{formatCredits(data.balance.availableMicro)}</dd>
		<dt>{m.admin_account_balance_debt()}</dt>
		<dd>{formatCredits(data.balance.debtMicro)}</dd>
	</dl>
	<p>
		<a href={resolve(`/admin/usuarios/${data.account.id}/ajuste`)}
			>{m.admin_account_adjust_link()}</a
		>
	</p>
</section>
<section aria-labelledby="movimientos-cuenta">
	<h2 id="movimientos-cuenta">{m.admin_account_movements_heading()}</h2>
	{#if data.movements.length === 0}
		<p>{m.admin_account_movements_empty()}</p>
	{:else}
		<ul>
			{#each data.movements as row, index (index)}
				<li>
					{new Date(row.createdAt).toLocaleString('es-ES')} · {row.type} · {formatCredits(
						row.amountMicro
					)}
				</li>
			{/each}
		</ul>
	{/if}
</section>
{#if data.account.banned}
	<Banner level="warning">
		{m.admin_users_state_blocked()}{data.account.banReason
			? `: ${m.admin_users_blocked_reason({ reason: data.account.banReason })}`
			: ''}
	</Banner>
{/if}
{#if errorText !== ''}
	<Banner level="critical">{errorText}</Banner>
{/if}

{#if !data.account.deleted}
	{#if !data.account.banned}
		<section aria-labelledby="bloquear">
			<h2 id="bloquear">{m.admin_users_block_heading()}</h2>
			<p>{m.admin_users_block_intro()}</p>
			<form method="POST" action="?/bloquear">
				<TextField id="motivo-bloqueo" name="motivo" label={m.admin_users_reason()} required />
				<Checkbox id="confirmado-bloqueo" name="confirmado" value="true"
					>{m.admin_users_confirm()}</Checkbox
				>
				<p><Button type="submit" variant="primary">{m.admin_users_submit_block()}</Button></p>
			</form>
		</section>
	{:else}
		<section aria-labelledby="desbloquear">
			<h2 id="desbloquear">{m.admin_users_unblock_heading()}</h2>
			<form method="POST" action="?/desbloquear">
				<TextField id="motivo-desbloqueo" name="motivo" label={m.admin_users_reason()} required />
				<Checkbox id="confirmado-desbloqueo" name="confirmado" value="true"
					>{m.admin_users_confirm()}</Checkbox
				>
				<p><Button type="submit" variant="primary">{m.admin_users_submit_unblock()}</Button></p>
			</form>
		</section>
	{/if}

	<section aria-labelledby="tester">
		<h2 id="tester">{m.admin_users_tester_heading()}</h2>
		<form method="POST" action="?/tester">
			<input
				type="hidden"
				name="on"
				value={data.account.role.split(',').includes('tester') ? 'false' : 'true'}
			/>
			<TextField id="motivo-tester" name="motivo" label={m.admin_users_reason()} />
			<Checkbox id="confirmado-tester" name="confirmado" value="true"
				>{m.admin_users_confirm()}</Checkbox
			>
			<p>
				<Button type="submit" variant="secondary">
					{data.account.role.split(',').includes('tester')
						? m.admin_users_submit_tester_off()
						: m.admin_users_submit_tester_on()}
				</Button>
			</p>
		</form>
	</section>

	<section aria-labelledby="sesiones">
		<h2 id="sesiones">{m.admin_users_sessions_heading()}</h2>
		<form method="POST" action="?/cerrarSesiones">
			<TextField id="motivo-sesiones" name="motivo" label={m.admin_users_reason()} required />
			<Checkbox id="confirmado-sesiones" name="confirmado" value="true"
				>{m.admin_users_confirm()}</Checkbox
			>
			<p><Button type="submit" variant="secondary">{m.admin_users_submit_close()}</Button></p>
		</form>
	</section>
{/if}

<p><a href={resolve('/admin/usuarios')}>{m.admin_users_title()}</a></p>
