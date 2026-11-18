<script lang="ts">
	/**
	 * CardHeader — título (+ descripción opcional vía children) más una
	 * zona de acciones opcional a la derecha (p. ej. un `IconButton` de
	 * "…" con `DropdownMenu`). Padding propio en las cuatro direcciones
	 * — ver el comentario de `Card.svelte` sobre por qué cada región trae
	 * el suyo en vez de que `Card` reparta uno solo.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		/** Añade un borde inferior — apagado por defecto (la tipografía ya separa visualmente). */
		divider?: boolean;
		actions?: Snippet;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { divider = false, actions, class: className = "", style: styleProp = "", children }: Props = $props();
</script>

<div class="gg-card-header {className}" class:gg-card-header--divider={divider} style={styleProp}>
	<div class="gg-card-header__content">
		{@render children?.()}
	</div>
	{#if actions}
		<div class="gg-card-header__actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.gg-card-header {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-5);
	}

	.gg-card-header--divider {
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-card-header__content {
		min-width: 0;
		flex: 1;
	}

	.gg-card-header__actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
