<script lang="ts">
	/**
	 * CardFooter — barra inferior, típicamente con `CardActions` dentro.
	 * `divider` (borde superior) por defecto ACTIVADO — al revés que
	 * `CardHeader`: un pie con botones de acción casi siempre se separa
	 * visualmente del cuerpo, mientras que un título casi nunca necesita
	 * ese refuerzo.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		divider?: boolean;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { divider = true, class: className = "", style: styleProp = "", children }: Props = $props();
</script>

<div class="gg-card-footer {className}" class:gg-card-footer--divider={divider} style={styleProp}>
	{@render children?.()}
</div>

<style>
	.gg-card-footer {
		box-sizing: border-box;
		padding: var(--space-5);
	}

	.gg-card-footer--divider {
		border-top: 1px solid var(--border-subtle);
	}
</style>
