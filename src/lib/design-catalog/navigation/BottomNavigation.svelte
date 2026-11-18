<script lang="ts">
	/**
	 * BottomNavigation (§10, móvil) — barra de navegación fija al fondo
	 * del viewport, para el patrón "3-5 destinos principales" de apps
	 * móviles. `env(safe-area-inset-bottom)` evita que el área segura de
	 * dispositivos con gesto de inicio (iOS) tape los elementos — no es
	 * un token del sistema (es una API del navegador, no un valor de
	 * diseño), así que se usa directo.
	 *
	 * Fondo `--surface`, no `--surface-raised`: el ítem activo pinta su
	 * texto/icono con `--interactive-primary`, que solo pasa AA como
	 * texto contra `--surface`/`--surface-sunken` en oscuro (3.87:1 si
	 * fuera contra `--surface-raised` — ver docs/TOKENS.md). La barra se
	 * separa del contenido con `border-top`, no con un salto de
	 * superficie.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		label?: string;
		class?: string;
		children: Snippet;
	}

	let { label = "Navegación", class: className = "", children }: Props = $props();
</script>

<nav aria-label={label} class="gg-bottom-nav bc-glass bc-glass--standard {className}">
	{@render children()}
</nav>

<style>
	.gg-bottom-nav {
		box-sizing: border-box;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: stretch;
		/* v1.9.0 — cristal con desenfoque: el contenido se desplaza por debajo. */
		--bc-glass-tint: var(--surface);
		--bc-glass-shadow: 0 0 0 transparent;
		border-top: 1px solid var(--border-subtle);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		z-index: var(--z-sticky);
	}
</style>
