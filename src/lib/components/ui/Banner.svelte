<script lang="ts">
	// Estados: «Información», «Aviso» y «Crítico», con texto, color e icono. Teclado: solo los enlaces que contenga, nativos.
	// Temas: colores de tokens en claro y oscuro. Efectos reducidos: sin transiciones ni cristal propios.
	// Banner de estado (DS-06; T255). El nivel se escribe como texto además del color y del icono: «Información», «Aviso» o
	// «Crítico». `critical` se anuncia con `role="alert"`, por el componente `Notice`.
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import Notice from './Notice.svelte';

	type Level = 'info' | 'warning' | 'critical';

	let { level = 'info', children }: { level?: Level; children: Snippet } = $props();

	const tone = $derived(level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'info');
	const prefix = $derived(
		level === 'critical'
			? m.banner_level_critical()
			: level === 'warning'
				? m.banner_level_warning()
				: m.banner_level_info()
	);
</script>

<Notice {tone}>
	<p><strong>{prefix}:</strong> {@render children()}</p>
</Notice>
