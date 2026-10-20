<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	// W47 · `/admin/auditoria/[entryId]`: una entrada con su motivo y sus instantáneas (T303; BE-FR-55). Solo lectura.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function show(value: unknown): string {
		return value === null || value === undefined
			? m.admin_audit_none()
			: JSON.stringify(value, null, 2);
	}
</script>

<svelte:head>
	<title>{m.admin_audit_entry_title()}</title>
</svelte:head>

<h1>{m.admin_audit_entry_title()}</h1>
<dl>
	<dt>{m.admin_audit_col_date()}</dt>
	<dd>{new Date(data.entry.createdAt).toLocaleString('es-ES')}</dd>
	<dt>{m.admin_audit_col_action()}</dt>
	<dd>{data.entry.action}</dd>
	<dt>{m.admin_audit_col_entity()}</dt>
	<dd>{data.entry.entity}{data.entry.entityId ? ` · ${data.entry.entityId}` : ''}</dd>
	<dt>{m.admin_audit_col_reason()}</dt>
	<dd>{data.entry.reason ?? m.admin_audit_none()}</dd>
</dl>

<h2>{m.admin_audit_before()}</h2>
<pre>{show(data.entry.before)}</pre>
<h2>{m.admin_audit_after()}</h2>
<pre>{show(data.entry.after)}</pre>

<p><Button href={resolve('/admin/auditoria')} variant="ghost">{m.admin_audit_back()}</Button></p>
