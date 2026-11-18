
<script lang="ts">
	/**
	 * DesktopMenuBar (§60.2) — "File  Edit  View  Window  Help". Del
	 * catálogo de 60.2 (`DesktopMenu`/`DesktopMenuItem`/`DesktopSubmenu`/
	 * `MenuSeparator`/`MenuShortcut`/`MenuCheckItem`/`MenuRadioItem`) solo
	 * `DesktopMenuBar` está en la lista curada de §69 — el resto son la
	 * forma de dato `DesktopMenu`/`DesktopMenuItem` (`tauri/types.ts`),
	 * mismo criterio que `PageHeader` con sus props. `MenuCheckItem`/
	 * `MenuRadioItem`/`DesktopSubmenu` quedan fuera de Fase 7 (no hay
	 * caso de uso curado que los pida) — decisión de alcance documentada
	 * también en `docs/ROADMAP.md`.
	 *
	 * NO reutiliza `DropdownMenu` (Fase 3) tal cual: una barra de menú de
	 * escritorio real tiene un patrón de teclado propio que `DropdownMenu`
	 * no cubre — con un menú YA abierto, ←/→ deben CERRAR ese menú y
	 * ABRIR el del botón vecino inmediatamente (así es como se navega un
	 * `File Edit View` nativo), no solo mover el foco entre disparadores.
	 * Sí reutiliza `Menu`/`MenuItem` (Fase 3) para el propio desplegable
	 * — mismo `role="menu"`/gestión de foco con flechas ↑/↓/Home/End ya
	 * verificados en Fase 3, sin reimplementar nada de eso.
	 *
	 * Patrón ARIA: `role="menubar"` en el contenedor, cada disparador
	 * `role="menuitem"` con roving tabindex (uno solo con `tabindex="0"`
	 * a la vez) — mismo patrón WAI-ARIA "menubar" que cualquier barra de
	 * menú nativa de escritorio expone a un lector de pantalla.
	 */
	import { untrack } from "svelte";
	import Menu from "../navigation/Menu.svelte";
	import MenuItem from "../navigation/MenuItem.svelte";
	import MenuSeparator from "../navigation/MenuSeparator.svelte";
	import type { DesktopMenu } from "./types.js";

	interface Props {
		menus: DesktopMenu[];
		class?: string | undefined;
	}

	let { menus, class: className = "" }: Props = $props();

	let root: HTMLDivElement | undefined = $state();
	let openIndex = $state<number | null>(null);
	let focusedIndex = $state(0);
	let menuRef: Menu | undefined = $state();

	function triggers(): HTMLButtonElement[] {
		if (!root) return [];
		return Array.from(root.querySelectorAll<HTMLButtonElement>('[data-menubar-trigger="true"]'));
	}

	function focusTrigger(index: number) {
		triggers()[index]?.focus();
	}

	function openAt(index: number, focusFirstItem: boolean) {
		openIndex = index;
		focusedIndex = index;
		if (focusFirstItem) {
			queueMicrotask(() => menuRef?.focusFirst());
		}
	}

	function close() {
		openIndex = null;
	}

	function onTriggerClick(index: number) {
		if (openIndex === index) {
			close();
			focusTrigger(index);
		} else {
			openAt(index, true);
		}
	}

	function onTriggerKeydown(e: KeyboardEvent, index: number) {
		if (e.key === "ArrowRight") {
			e.preventDefault();
			const next = (index + 1) % menus.length;
			focusedIndex = next;
			if (openIndex !== null) openAt(next, true);
			else focusTrigger(next);
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			const prev = (index - 1 + menus.length) % menus.length;
			focusedIndex = prev;
			if (openIndex !== null) openAt(prev, true);
			else focusTrigger(prev);
		} else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openAt(index, true);
		} else if (e.key === "Escape" && openIndex !== null) {
			e.preventDefault();
			close();
			focusTrigger(index);
		} else if (e.key === "Home") {
			e.preventDefault();
			focusedIndex = 0;
			if (openIndex !== null) openAt(0, true);
			else focusTrigger(0);
		} else if (e.key === "End") {
			e.preventDefault();
			const last = menus.length - 1;
			focusedIndex = last;
			if (openIndex !== null) openAt(last, true);
			else focusTrigger(last);
		}
	}

	function onMenuClose(reason: "escape" | "tab") {
		const wasOpenIndex = untrack(() => openIndex);
		close();
		if (reason === "escape" && wasOpenIndex !== null) focusTrigger(wasOpenIndex);
	}

	$effect(() => {
		if (openIndex === null) return;

		function onDocumentMousedown(e: MouseEvent) {
			if (root && !root.contains(e.target as Node)) close();
		}

		document.addEventListener("mousedown", onDocumentMousedown);
		return () => document.removeEventListener("mousedown", onDocumentMousedown);
	});
</script>

<div bind:this={root} role="menubar" aria-label="Menú principal" class="gg-desktop-menu-bar {className}">
	{#each menus as menu, index (menu.id)}
		<div class="gg-desktop-menu-bar__item">
			<button
				type="button"
				data-menubar-trigger="true"
				role="menuitem"
				aria-haspopup="menu"
				aria-expanded={openIndex === index}
				tabindex={focusedIndex === index ? 0 : -1}
				class="gg-desktop-menu-bar__trigger"
				class:gg-desktop-menu-bar__trigger--open={openIndex === index}
				onclick={() => onTriggerClick(index)}
				onkeydown={(e) => onTriggerKeydown(e, index)}
				onfocus={() => (focusedIndex = index)}
			>
				{menu.label}
			</button>
			{#if openIndex === index}
				<div class="gg-desktop-menu-bar__popover">
					<Menu bind:this={menuRef} onclose={onMenuClose}>
						{#each menu.items as item (item.id)}
							<MenuItem
								disabled={item.disabled}
								onclick={() => {
									item.onselect?.();
									close();
									focusTrigger(index);
								}}
							>
								<span class="gg-desktop-menu-bar__item-row">
									<span>{item.label}</span>
									{#if item.shortcut}
										<span class="gg-desktop-menu-bar__shortcut">{item.shortcut}</span>
									{/if}
								</span>
							</MenuItem>
							{#if item.separatorAfter}
								<MenuSeparator />
							{/if}
						{/each}
					</Menu>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.gg-desktop-menu-bar {
		box-sizing: border-box;
		display: flex;
		align-items: stretch;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		font-family: var(--font-sans);
	}

	.gg-desktop-menu-bar__item {
		position: relative;
	}

	.gg-desktop-menu-bar__trigger {
		box-sizing: border-box;
		height: var(--space-8);
		padding: 0 var(--space-3);
		border: none;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		font-size: var(--text-body-sm-size);
		cursor: pointer;
	}

	.gg-desktop-menu-bar__trigger:hover,
	.gg-desktop-menu-bar__trigger--open {
		background: var(--surface-raised);
	}

	.gg-desktop-menu-bar__trigger:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-desktop-menu-bar__popover {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: var(--z-dropdown);
		margin-top: 1px;
	}

	.gg-desktop-menu-bar__item-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-6);
		width: 100%;
	}

	.gg-desktop-menu-bar__shortcut {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}
</style>
