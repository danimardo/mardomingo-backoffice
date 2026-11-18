<script lang="ts">
	/**
	 * ContextMenu (§10, catálogo completo) — menú contextual por clic
	 * derecho, dejado fuera deliberadamente en Fase 3 junto con
	 * `Submenu`/`MegaMenu`/`CommandMenu` (ver `docs/ROADMAP.md`). Reutiliza
	 * `Menu`/`MenuItem` (Fase 3) para el propio menú — roving tabindex,
	 * Escape/Tab, ↑/↓/Home/End salen GRATIS, igual que hizo `DropdownMenu` —
	 * lo único nuevo aquí es CÓMO se coloca (en el punto del cursor, no
	 * junto a un disparador) y CUÁNDO se abre (`contextmenu`, no `click`).
	 *
	 * Se monta en `document.body` (`use:portal`, Fase 5) porque el punto
	 * de apertura es arbitrario — puede estar pegado al borde del
	 * viewport, así que hace falta recortar TANTO en horizontal como en
	 * vertical (a diferencia de `DropdownMenu`, que solo voltea en
	 * vertical porque su horizontal ya lo fija `placement` relativo al
	 * disparador).
	 *
	 * El foco se captura al abrir (como hace `focusTrap.ts` con
	 * `Dialog`/`Modal`) y se devuelve al cerrar por Escape o clic fuera —
	 * un clic derecho normalmente NO mueve el foco del navegador, así que
	 * sin esto el foco de teclado se quedaría "perdido" tras cerrar el
	 * menú.
	 */
	import type { Snippet } from "svelte";
	import { portal } from "../feedback/portal.js";
	import Menu from "./Menu.svelte";
	import { isInsideSubmenuPanel } from "./submenuPanel.js";

	interface TriggerProps {
		oncontextmenu: (e: MouseEvent) => void;
	}

	interface Props {
		trigger: Snippet<[{ triggerProps: TriggerProps }]>;
		open?: boolean;
		class?: string;
		children: Snippet;
	}

	let { trigger, open = $bindable(false), class: className = "", children }: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-context-menu`;

	let menuEl: HTMLDivElement | undefined = $state();
	let menuRef: Menu | undefined = $state();
	let x = $state(0);
	let y = $state(0);
	let previouslyFocused: HTMLElement | null = null;

	let triggerProps: TriggerProps = { oncontextmenu: onOpen };

	function onOpen(e: MouseEvent) {
		e.preventDefault();
		previouslyFocused = document.activeElement as HTMLElement | null;
		x = e.clientX;
		y = e.clientY;
		open = true;
	}

	function close(refocus: boolean) {
		if (!open) return;
		open = false;
		if (refocus) previouslyFocused?.focus();
		previouslyFocused = null;
	}

	function clampToViewport() {
		if (!menuEl) return;
		const rect = menuEl.getBoundingClientRect();
		if (rect.right > window.innerWidth) x = Math.max(0, window.innerWidth - rect.width);
		if (rect.bottom > window.innerHeight) y = Math.max(0, window.innerHeight - rect.height);
	}

	$effect(() => {
		if (!open) return;

		queueMicrotask(() => {
			clampToViewport();
			menuRef?.focusFirst();
		});

		function onDocumentMousedown(e: MouseEvent) {
			// Mismo motivo que en `DropdownMenu`: un `SubmenuItem` anidado
			// aquí montaría su panel con portal, fuera del subárbol de
			// `menuEl` — ver `submenuPanel.ts`. `ContextMenu` no lo usa en
			// esta ampliación, pero comparte `Menu`/`MenuItem`, así que
			// nada impide anidarlo aquí también; sin este extra se rompería
			// igual que se rompía en `DropdownMenu` antes del arreglo.
			const target = e.target as Node;
			if (menuEl && !menuEl.contains(target) && !isInsideSubmenuPanel(target)) close(false);
		}

		document.addEventListener("mousedown", onDocumentMousedown);
		return () => document.removeEventListener("mousedown", onDocumentMousedown);
	});
</script>

{@render trigger({ triggerProps })}

{#if open}
	<div bind:this={menuEl} class="gg-context-menu {className}" style="top:{y}px; left:{x}px;" use:portal>
		<Menu id={menuId} onclose={(reason) => close(reason !== "tab")} bind:this={menuRef}>
			{@render children()}
		</Menu>
	</div>
{/if}

<style>
	.gg-context-menu {
		position: fixed;
		z-index: var(--z-context-menu);
	}
</style>
