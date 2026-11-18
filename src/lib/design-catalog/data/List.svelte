<script lang="ts">
	/**
	 * List (§16) — contenedor `<ul>`/`<ol>` genérico. Un solo componente
	 * para lista ordenada/no ordenada vía la prop `as` — igual que
	 * `Input` cubre 7 tipos con una sola pieza en vez de
	 * `OrderedList`/`UnorderedList` por separado.
	 *
	 * Alcance deliberado (ver docs/ROADMAP.md): el catálogo completo
	 * (§16) tiene ~18 variantes derivadas más (`ActionList`,
	 * `ContactList`, `VirtualList`, `SortableList`...) — cada una añade
	 * su propio comportamiento real (virtualización, drag-and-drop,
	 * selección múltiple) y no están en la lista curada de Fase 4. Lo
	 * que SÍ trae `ListItem` de fábrica —fila clicable con `href`/
	 * `onclick`, contenido líder/final— cubre el caso simple sin
	 * necesitar todavía una `ActionList` aparte.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		as?: "ul" | "ol";
		/** Línea divisoria entre items consecutivos. */
		divided?: boolean;
		/** v1.9.0 — entrada escalonada de los elementos al montarse (28 ms entre uno y otro, hasta el octavo). Respeta `prefers-reduced-motion` y los efectos apagados. */
		stagger?: boolean;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { as = "ul", divided = false, stagger = true, class: className = "", style: styleProp = "", children }: Props = $props();
</script>

<svelte:element this={as} class="gg-list {className}" class:gg-list--divided={divided} class:bc-anim-stagger={stagger} style={styleProp}>
	{@render children?.()}
</svelte:element>

<style>
	.gg-list {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-list--divided :global(.gg-list-item) {
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-list--divided :global(.gg-list-item:last-child) {
		border-bottom: none;
	}
</style>
