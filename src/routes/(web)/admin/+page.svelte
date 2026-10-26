<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	// W33 · `/admin`: resumen del administrador (T304; BE-FR-46). Alertas activas con su fecha y el estado del freno. Sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Banner from '$lib/components/ui/Banner.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.admin_home_title()}</title>
</svelte:head>

<h1>{m.admin_home_title()}</h1>

<section aria-labelledby="alertas">
	<h2 id="alertas">{m.admin_home_alerts()}</h2>
	{#if data.alerts.length === 0}
		<p>{m.admin_home_no_alerts()}</p>
	{:else}
		<ul>
			{#each data.alerts as alert (alert.key)}
				<li>
					<Banner level="warning"
						>{alert.key} · {new Date(alert.activatedAt).toLocaleString('es-ES')}</Banner
					>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="freno-resumen">
	<h2 id="freno-resumen">{m.admin_home_brake()}</h2>
	<p>
		{data.brake.active ? m.admin_protections_brake_active() : m.admin_protections_brake_inactive()}
	</p>
	<p>
		<Button href={resolve('/admin/protecciones')} variant="ghost"
			>{m.admin_protections_title()}</Button
		>
	</p>
</section>

<section aria-labelledby="cuentas-resumen">
	<h2 id="cuentas-resumen">{m.admin_home_accounts({ count: String(data.accounts) })}</h2>
	<p>
		<a href={resolve('/admin/usuarios')}>{m.admin_users_title()}</a> ·
		<a href={resolve('/admin/auditoria')}>{m.admin_audit_title()}</a>
	</p>
</section>
