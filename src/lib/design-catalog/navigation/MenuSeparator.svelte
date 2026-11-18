<script lang="ts">
	/**
	 * MenuSeparator — línea divisoria entre grupos de `MenuItem`.
	 * `role="separator"` (implícito en `<hr>`, aquí explícito porque el
	 * elemento visual es un `<div>` para controlar el margen con las
	 * mismas claves de espaciado del sistema).
	 */
	interface Props {
		class?: string;
	}

	let { class: className = "" }: Props = $props();
</script>

<div role="separator" class="gg-menu-separator {className}"></div>

<style>
	.gg-menu-separator {
		height: 1px;
		margin: var(--space-1) var(--space-2);
		background: var(--border-subtle);
	}
</style>
