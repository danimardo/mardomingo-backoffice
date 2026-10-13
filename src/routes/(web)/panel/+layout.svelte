<script lang="ts">
	// Layout del panel (T259). No es barrera: el `load` de cada página y cada acción comprueban la sesión (contracts/web-routes.md).
	// Aquí solo va la navegación común, con las mismas etiquetas que los títulos de cada página.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import PanelNav from '$lib/components/layout/PanelNav.svelte';

	let { children }: { children: Snippet } = $props();

	const links = $derived([
		{ href: resolve('/panel'), label: m.panel_nav_home() },
		{ href: resolve('/panel/comprar'), label: m.payments_title() },
		{ href: resolve('/panel/movimientos'), label: m.movements_title() },
		{ href: resolve('/panel/consumo'), label: m.consumption_title() },
		{ href: resolve('/panel/sesiones'), label: m.sessions_title() },
		{ href: resolve('/panel/apps'), label: m.apps_title() },
		{ href: resolve('/panel/facturas'), label: m.invoices_title() }
	]);
</script>

<PanelNav {links} label={m.panel_nav_label()} />

{@render children()}
