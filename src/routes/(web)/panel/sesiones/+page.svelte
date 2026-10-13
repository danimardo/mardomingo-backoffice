<script lang="ts">
	// W26 · `/panel/sesiones`: sesiones vigentes con su fecha de creación y de último uso, dispositivo e IP aproximada.
	import * as m from '$lib/paraglide/messages.js';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const rows = $derived(
		data.sessions.map((item) => [
			item.createdOn,
			item.lastUsedOn ?? m.sessions_never_used(),
			item.deviceName === '' ? m.sessions_device_unknown() : item.deviceName,
			item.approxIp === '' ? m.sessions_ip_unknown() : item.approxIp
		])
	);
	const columns = [
		{ key: 'created', label: m.sessions_col_created(), align: 'start' as const },
		{ key: 'used', label: m.sessions_col_used(), align: 'start' as const },
		{ key: 'device', label: m.sessions_col_device(), align: 'start' as const },
		{ key: 'ip', label: m.sessions_col_ip(), align: 'start' as const }
	];
</script>

<svelte:head>
	<title>{m.sessions_title()}</title>
</svelte:head>

<h1>{m.sessions_title()}</h1>
<p>{m.sessions_hint()}</p>

{#if rows.length > 0}
	<DataTable caption={m.sessions_caption()} {columns} {rows} />
{:else}
	<EmptyState variant="empty" />
{/if}
