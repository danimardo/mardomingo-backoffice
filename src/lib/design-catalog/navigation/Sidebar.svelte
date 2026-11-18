<script lang="ts">
	/**
	 * Sidebar (§10) — panel de navegación vertical. Es un `<nav>` con
	 * nombre propio y `collapsed` (rueda a modo icono) compartido por
	 * contexto de Svelte con `SidebarItem`/`SidebarSection`, para que
	 * cada hijo sepa si debe ocultar su etiqueta de texto sin que el
	 * consumidor tenga que repetir la prop en cada uno.
	 *
	 * El fondo usa `--surface` (no `--surface-raised`, y no cristal por
	 * defecto) — deliberado: `--interactive-primary`/`--status-*` como
	 * TEXTO solo están verificados AA contra `--surface`/`--surface-sunken`
	 * (ver docs/TOKENS.md); contra `--surface-raised` el tema oscuro cae a
	 * 3.87:1. La separación visual del contenido la da el borde
	 * (`--border-subtle`), no un salto de superficie. Un panel que
	 * reutilizará `Surface` con `glass` cuando haga falta lo hará por
	 * composición (`<Surface glass><Sidebar>...`), no porque Sidebar
	 * imponga un material fijo.
	 */
	import { setContext } from "svelte";
	import type { Snippet } from "svelte";

	export interface SidebarContext {
		readonly collapsed: boolean;
	}

	interface Props {
		collapsed?: boolean;
		label?: string;
		class?: string;
		children?: Snippet;
	}

	let { collapsed = $bindable(false), label = "Navegación principal", class: className = "", children }: Props = $props();

	setContext<SidebarContext>("gg-sidebar", {
		get collapsed() {
			return collapsed;
		}
	});
</script>

<nav aria-label={label} class="gg-sidebar bc-glass-inline bc-glass--standard {className}" class:gg-sidebar--collapsed={collapsed}>
	{@render children?.()}
</nav>

<style>
	.gg-sidebar {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		/* Anchura expandida/colapsada expresadas con las mismas claves de
		   --space-N que el resto del sistema (16rem/4rem), no valores
		   sueltos inventados para este componente. */
		width: var(--space-64);
		padding: var(--space-3);
		/* v1.9.0 — cristal en el flujo (sin desenfoque): deja ver el fondo
		   ambiental; con efectos reducidos o apagados, --surface como antes. */
		--bc-glass-tint: var(--surface);
		--bc-glass-shadow: 0 0 0 transparent;
		border-right: 1px solid var(--border-subtle);
		transition: width var(--duration-normal) var(--easing-standard);
	}

	.gg-sidebar--collapsed {
		width: var(--space-16);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-sidebar {
			transition: none;
		}
	}
</style>
