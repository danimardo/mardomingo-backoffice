<script lang="ts">
	/**
	 * AnimatedBackground (v1.9.0) — el fondo ambiental de BeCall: el color
	 * base de la paleta y cuatro manchas radiales que se desplazan muy
	 * despacio (26–35 s por recorrido, solo `transform`).
	 *
	 * Decorativo: `aria-hidden`, sin eventos de puntero y detrás de todo
	 * (`z-index: -1`). `AppShell` ya lo monta por defecto (`background`);
	 * fuera de `AppShell`, móntalo una vez por ventana.
	 *
	 * - `position="fixed"` (por defecto) cubre la ventana.
	 * - `position="fill"` cubre su contenedor, que debe tener
	 *   `position: relative` e `isolation: isolate` (así lo usa `AppShell`).
	 *
	 * Paleta, intensidad y movimiento salen de atributos de <html>
	 * (`createAppearanceController`); este componente no tiene props de
	 * color. Se detiene con la ventana oculta, con «Fondo animado»
	 * desactivado, con los efectos apagados y con `prefers-reduced-motion`.
	 * Con `forced-colors` desaparecen las manchas.
	 */
	import { onMount } from "svelte";

	interface Props {
		position?: "fixed" | "fill";
		class?: string;
	}

	let { position = "fixed", class: className = "" }: Props = $props();

	let hidden = $state(false);

	onMount(() => {
		const update = () => (hidden = document.visibilityState === "hidden");
		update();
		document.addEventListener("visibilitychange", update);
		return () => document.removeEventListener("visibilitychange", update);
	});
</script>

<div
	class="bc-ambient {position === 'fill' ? 'bc-ambient--fill' : ''} {className}"
	class:bc-ambient--paused={hidden}
	aria-hidden="true"
>
	<span class="bc-ambient__blob bc-ambient__blob--1"></span>
	<span class="bc-ambient__blob bc-ambient__blob--2"></span>
	<span class="bc-ambient__blob bc-ambient__blob--3"></span>
	<span class="bc-ambient__blob bc-ambient__blob--4"></span>
</div>
