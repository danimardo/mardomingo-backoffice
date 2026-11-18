<script lang="ts">
	/**
	 * CardMedia — zona de imagen/vídeo a sangre en el borde de la
	 * tarjeta. `Card` NO recorta su contenido (`overflow` normal, no
	 * `hidden`) a propósito — un `CardHeader` con un `DropdownMenu` de
	 * acciones necesita que su popover pueda salirse del recuadro de la
	 * tarjeta sin que se corte. Por eso `CardMedia` redondea sus PROPIAS
	 * esquinas superiores (`radius`, mismo valor que le des a `Card`) en
	 * vez de depender de que el padre recorte por él — colócalo como
	 * primer hijo de `Card` para que el resultado visual cuadre.
	 */
	import type { Snippet } from "svelte";
	import type { RadiusToken } from "../primitives/types.js";

	interface Props {
		radius?: RadiusToken;
		/** p. ej. `"16/9"`, `"4/3"` — pasa a `aspect-ratio` directo. */
		aspectRatio?: string;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { radius = "lg", aspectRatio, class: className = "", style: styleProp = "", children }: Props = $props();

	let inlineStyle = $derived(
		`border-radius: var(--radius-${radius}) var(--radius-${radius}) 0 0;` +
			(aspectRatio ? `aspect-ratio: ${aspectRatio};` : "") +
			styleProp
	);
</script>

<div class="gg-card-media {className}" style={inlineStyle}>
	{@render children?.()}
</div>

<style>
	.gg-card-media {
		box-sizing: border-box;
		overflow: hidden;
		display: flex;
		background: var(--surface-sunken);
	}

	.gg-card-media :global(img),
	.gg-card-media :global(video) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
