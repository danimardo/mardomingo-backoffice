<script lang="ts">
	// Anuncios del panel (W18; T261; BE-FR-85). Cada anuncio es un `Banner` con su nivel; el nombre de la app va delante si lo hay.
	import Banner from '$lib/components/ui/Banner.svelte';

	interface Item {
		readonly id: string;
		readonly level: 'info' | 'warning' | 'critical';
		readonly message: string;
		readonly appName: string | null;
	}

	let { items }: { items: readonly Item[] } = $props();
</script>

{#each items as item (item.id)}
	<Banner level={item.level}>
		{#if item.appName !== null}{item.appName}:
		{/if}{item.message}
	</Banner>
{/each}
