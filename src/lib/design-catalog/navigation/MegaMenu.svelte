<script lang="ts">
	/**
	 * MegaMenu (ampliación 3, §10 — dejado fuera en Fase 3 junto con
	 * `ContextMenu`/`Submenu`/`CommandMenu`, ver `docs/ROADMAP.md`;
	 * `ContextMenu`/`SubmenuItem` ya se construyeron en las ampliaciones
	 * 1/2) — un `DropdownMenu` cuyo panel se organiza en VARIAS COLUMNAS
	 * (`MegaMenuSection`, cada una con su propio encabezado), típico de
	 * una barra de navegación con "Productos"/"Soluciones" que despliega
	 * un panel ancho agrupado en vez de una lista vertical simple.
	 *
	 * Reutiliza `Menu`/`MenuItem` (Fase 3) para TODO el mecanismo de
	 * teclado/ARIA — ↑/↓/Home/End/Escape/Tab funcionan gratis, idéntico a
	 * `DropdownMenu`. La única diferencia real con `DropdownMenu` es
	 * VISUAL: el panel interior es una rejilla CSS de columnas en vez de
	 * una columna única, y por eso es más ancho. Deliberadamente NO hay
	 * navegación 2D por flechas (Arriba/Abajo saltando de columna en
	 * columna en la posición equivalente) — eso exigiría su propio
	 * cálculo de posiciones en rejilla, una pieza de complejidad
	 * claramente distinta; en su lugar, ↓/↑ recorren TODOS los items en
	 * orden de documento (columna 1 completa, luego columna 2...), que es
	 * exactamente lo que `Menu.svelte` ya hace sin cambios — suficiente
	 * para un menú de enlaces de navegación, donde el uso real por
	 * teclado es "bajar hasta encontrar el enlace", no saltar en rejilla.
	 * Home/End siguen saltando al primer/último item de TODO el menú, no
	 * por columna, mismo motivo.
	 *
	 * Mismo criterio de `flipIfNeeded`/click fuera/`isInsideSubmenuPanel`
	 * que `DropdownMenu` — no se ha extraído a un módulo compartido
	 * porque habría significado parametrizar precisamente las dos
	 * diferencias reales (ancho del panel, layout de rejilla del
	 * contenido), el mismo motivo que ya separó `Popover` de
	 * `DropdownMenu` en vez de forzar una base común.
	 */
	import { untrack } from "svelte";
	import type { Snippet } from "svelte";
	import Menu from "./Menu.svelte";
	import { isInsideSubmenuPanel } from "./submenuPanel.js";

	type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

	interface TriggerProps {
		"aria-haspopup": "menu";
		"aria-expanded": boolean;
		"aria-controls": string;
		onclick: () => void;
	}

	interface Props {
		trigger: Snippet<[{ toggle: () => void; triggerProps: TriggerProps }]>;
		open?: boolean;
		placement?: Placement;
		class?: string;
		/** `MegaMenuSection`s — cada una es una columna de la rejilla. */
		children: Snippet;
	}

	let { trigger, open = $bindable(false), placement = "bottom-start", class: className = "", children }: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-mega-menu`;

	let container: HTMLDivElement | undefined = $state();
	let menuRef: Menu | undefined = $state();
	let effectivePlacement = $state(untrack(() => placement));

	let triggerProps = $derived<TriggerProps>({
		"aria-haspopup": "menu",
		"aria-expanded": open,
		"aria-controls": menuId,
		onclick: toggle
	});

	function focusTrigger() {
		container?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
	}

	function openMenu() {
		effectivePlacement = placement;
		open = true;
	}

	function close(refocus: boolean) {
		if (!open) return;
		open = false;
		if (refocus) focusTrigger();
	}

	function toggle() {
		if (open) close(true);
		else openMenu();
	}

	function flipIfNeeded() {
		const menuEl = container?.querySelector<HTMLElement>('[role="menu"]');
		if (!menuEl) return;
		const rect = menuEl.getBoundingClientRect();
		const isBottom = effectivePlacement.startsWith("bottom");
		if (isBottom && rect.bottom > window.innerHeight) {
			effectivePlacement = effectivePlacement.replace("bottom", "top") as Placement;
		} else if (!isBottom && rect.top < 0) {
			effectivePlacement = effectivePlacement.replace("top", "bottom") as Placement;
		}
	}

	$effect(() => {
		if (!open) return;

		queueMicrotask(() => {
			menuRef?.focusFirst();
			flipIfNeeded();
		});

		function onDocumentMousedown(e: MouseEvent) {
			const target = e.target as Node;
			if (container && !container.contains(target) && !isInsideSubmenuPanel(target)) {
				close(false);
			}
		}

		document.addEventListener("mousedown", onDocumentMousedown);
		return () => document.removeEventListener("mousedown", onDocumentMousedown);
	});
</script>

<div bind:this={container} class="gg-mega-menu {className}">
	{@render trigger({ toggle, triggerProps })}
	{#if open}
		<div class="gg-mega-menu__popover gg-mega-menu__popover--{effectivePlacement}">
			<Menu bind:this={menuRef} id={menuId} class="gg-mega-menu__menu" onclose={(reason) => close(reason !== "tab")}>
				{@render children()}
			</Menu>
		</div>
	{/if}
</div>

<style>
	.gg-mega-menu {
		position: relative;
		display: inline-block;
	}

	.gg-mega-menu__popover {
		position: absolute;
		z-index: var(--z-dropdown);
		max-width: var(--overlay-width-lg);
	}

	.gg-mega-menu__popover--bottom-start {
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
	}

	.gg-mega-menu__popover--bottom-end {
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
	}

	.gg-mega-menu__popover--top-start {
		bottom: 100%;
		left: 0;
		margin-bottom: var(--space-1);
	}

	.gg-mega-menu__popover--top-end {
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
	}

	/* `:global` porque ".gg-menu" vive en el CSS con ámbito de
	   `Menu.svelte` — este selector no puede alcanzarlo de otro modo.
	   Combinar AMBAS clases (".gg-menu.gg-mega-menu__menu", especificidad
	   0-0-2-0) en vez de una sola con `!important` — gana de forma
	   determinista sobre ".gg-menu" (0-0-1-0) sin depender del orden de
	   carga de las hojas de estilo de cada componente. Solo sustituye el
	   layout (columna única -> rejilla); el resto del aspecto visual de
	   `.gg-menu` (fondo, borde, sombra) se hereda tal cual. */
	:global(.gg-menu.gg-mega-menu__menu) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(var(--space-40), 1fr));
		min-width: var(--overlay-width-sm);
	}
</style>
