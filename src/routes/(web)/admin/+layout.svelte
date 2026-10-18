<script lang="ts">
	// Layout de administración (T300; 16.5): aviso del freno global, navegación con `aria-current` y alertas activas. La navegación
	// es el componente del sistema de diseño `PanelNav`; no hay un `Sidebar` propio (ver la decisión en `tasks.md`).
	import Banner from '$lib/components/ui/Banner.svelte';
	import PanelNav from '$lib/components/layout/PanelNav.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

{#if data.isAdmin}
	{#if data.brakeActive}
		<Banner level="critical">{m.admin_layout_brake_active()}</Banner>
	{/if}
	{#if data.alertsActiveCount > 0}
		<p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- el enlace llega ya resuelto desde el layout del servidor -->
			<a href={data.alertsHref}>{m.admin_layout_alerts({ count: data.alertsActiveCount })}</a>
		</p>
	{/if}
	<PanelNav links={data.links} label={m.admin_nav_label()} />
{/if}

{@render children()}
