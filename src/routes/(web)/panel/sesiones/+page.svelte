<script lang="ts">
	// W26 · `/panel/sesiones`: sesiones abiertas con fecha, último uso, dispositivo e IP aproximada. Cada sesión ajena tiene su
	// botón de cierre (un formulario POST, sin JavaScript). La sesión actual se marca como tal y no tiene botón.
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{m.sessions_title()}</title>
</svelte:head>

<h1>{m.sessions_title()}</h1>
<p>{m.sessions_hint()}</p>

{#if data.closed}
	<Banner level="info">{m.sessions_closed_notice()}</Banner>
{/if}
{#if data.allClosed}
	<Banner level="info">{m.sessions_all_closed_notice()}</Banner>
{/if}
{#if form?.errors.sessionId}
	<Banner level="critical">{m.sessions_close_error()}</Banner>
{/if}

{#if data.sessions.length === 0}
	<EmptyState variant="empty" />
{:else}
	<ul class="sessions">
		{#each data.sessions as item (item.id)}
			<li class="session">
				<p>
					<strong>{item.deviceName === '' ? m.sessions_device_unknown() : item.deviceName}</strong>
					{#if item.current}
						<span>{m.sessions_this_one()}</span>
					{/if}
				</p>
				<p>{m.sessions_col_created()}: {item.createdOn}</p>
				<p>{m.sessions_col_used()}: {item.lastUsedOn ?? m.sessions_never_used()}</p>
				<p>
					{m.sessions_col_ip()}: {item.approxIp === '' ? m.sessions_ip_unknown() : item.approxIp}
				</p>
				{#if !item.current}
					<form method="POST" action="?/cerrar">
						<input type="hidden" name="sessionId" value={item.id} />
						<Button type="submit" variant="secondary"
							>{m.sessions_close({
								device: item.deviceName === '' ? m.sessions_device_unknown() : item.deviceName
							})}</Button
						>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
	{#if data.sessions.some((item) => !item.current)}
		<form method="POST" action="?/cerrarTodas">
			<p>{m.sessions_close_all_hint()}</p>
			<Button type="submit" variant="secondary">{m.sessions_close_all()}</Button>
		</form>
	{/if}
{/if}

<style>
	.sessions {
		display: grid;
		gap: 1rem;
		list-style: none;
		padding: 0;
	}
	.session {
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 1rem;
	}
</style>
