<script lang="ts">
	/**
	 * Menu (§10) — contenedor `role="menu"` con foco gestionado a mano
	 * (patrón "roving tabindex"): las flechas ↑/↓ mueven el foco entre
	 * los `MenuItem` (todos con `tabindex="-1"`, así que Tab nunca se
	 * detiene dentro del menú), Home/End saltan al primero/último,
	 * Escape cierra. Tab también cierra pero SIN `preventDefault`, para
	 * dejar que el foco salga del menú de forma nativa en vez de
	 * atraparlo dentro.
	 *
	 * No gestiona su propia visibilidad ni posición — eso es trabajo de
	 * `DropdownMenu`, que monta este componente y le pasa `onclose`.
	 * `Menu` en solitario también sirve como menú siempre visible
	 * embebido en la página, sin popover.
	 *
	 * Fondo `--surface`, no `--surface-raised`: `MenuItem` pinta su
	 * variante `danger` con `--status-danger`, que en oscuro solo pasa
	 * AA como texto contra `--surface`/`--surface-sunken` (4.10:1 contra
	 * `--surface-raised` — bajo AA; ver docs/TOKENS.md). El borde +
	 * `box-shadow: var(--shadow-floating)` ya distinguen el menú del
	 * fondo sin necesitar un salto de superficie.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		id?: string;
		class?: string;
		onclose?: (reason: "escape" | "tab") => void;
		children: Snippet;
	}

	let { id, class: className = "", onclose, children }: Props = $props();
	let root: HTMLDivElement | undefined = $state();

	function items(): HTMLElement[] {
		if (!root) return [];
		return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
	}

	export function focusFirst() {
		items()[0]?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		const list = items();
		if (list.length === 0) return;
		const currentIndex = list.indexOf(document.activeElement as HTMLElement);

		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
			list[next]?.focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = currentIndex < 0 ? list.length - 1 : (currentIndex - 1 + list.length) % list.length;
			list[next]?.focus();
		} else if (e.key === "Home") {
			e.preventDefault();
			list[0]?.focus();
		} else if (e.key === "End") {
			e.preventDefault();
			list[list.length - 1]?.focus();
		} else if (e.key === "Escape") {
			e.preventDefault();
			onclose?.("escape");
		} else if (e.key === "Tab") {
			// El foco sale del menú de forma nativa (sin preventDefault);
			// solo avisamos al padre de que debe considerarse cerrado, con
			// un motivo distinto de "escape" para que no intente devolver
			// el foco al disparador y pelee con el Tab nativo.
			onclose?.("tab");
		}
	}
</script>

<div bind:this={root} {id} role="menu" tabindex="-1" class="gg-menu bc-glass bc-glass--standard bc-anim-rise {className}" onkeydown={onKeydown}>
	{@render children()}
</div>

<style>
	.gg-menu {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: var(--space-48);
		padding: var(--space-1);
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}
</style>
