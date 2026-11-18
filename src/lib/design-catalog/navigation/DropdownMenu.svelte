<script lang="ts">
	/**
	 * DropdownMenu (§10) — monta un `Menu` como popover junto a un
	 * disparador arbitrario. El consumidor aporta el elemento disparador
	 * vía el snippet `trigger`: DropdownMenu le da `triggerProps` con los
	 * atributos ARIA correctos (`aria-haspopup`/`aria-expanded`/
	 * `aria-controls`) más `onclick`, en vez de imponer un `<button>`
	 * propio — así el disparador puede ser cualquier cosa (IconButton,
	 * Button, un elemento a medida).
	 *
	 * Cierre por click fuera (listener de `mousedown` en `document`,
	 * añadido/quitado en el cleanup de un `$effect` — solo mientras está
	 * abierto), por Escape y por Tab (ambos delegados en `Menu`, que
	 * distingue el motivo). Al cerrar por Escape o por click fuera se
	 * devuelve el foco al disparador; al cerrar por Tab no, porque el
	 * foco ya está siguiendo su curso nativo hacia el siguiente elemento
	 * y devolverlo pelearía con el navegador.
	 *
	 * `placement` es solo la preferencia inicial. Si el menú no cabe en
	 * esa dirección dentro del viewport se voltea en vertical una vez,
	 * justo después de abrir (comprobación ligera con
	 * `getBoundingClientRect`, sin librería de posicionamiento — mismo
	 * criterio de dependencias mínimas que el resto del paquete).
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
		children: Snippet;
	}

	let { trigger, open = $bindable(false), placement = "bottom-start", class: className = "", children }: Props = $props();

	const uid = $props.id();
	const menuId = `${uid}-dropdown-menu`;

	let container: HTMLDivElement | undefined = $state();
	let menuRef: Menu | undefined = $state();
	// Solo la preferencia INICIAL de colocación — `openMenu()` la
	// reafirma en cada apertura y `flipIfNeeded()` la corrige si no cabe.
	// `untrack` deja explícito que es una foto de un instante, no un
	// espejo reactivo de la prop `placement`.
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
			// `isInsideSubmenuPanel`: un `SubmenuItem` (ampliación 2) anidado
			// aquí dentro monta su panel con portal, fuera del subárbol de
			// `container` — sin este extra, un click en un item del submenú
			// se vería como un click fuera y cerraría este `DropdownMenu`
			// antes de que ese `click` llegara a disparar nada. Ver
			// `submenuPanel.ts` para el porqué completo.
			if (container && !container.contains(target) && !isInsideSubmenuPanel(target)) {
				close(false);
			}
		}

		document.addEventListener("mousedown", onDocumentMousedown);
		return () => document.removeEventListener("mousedown", onDocumentMousedown);
	});
</script>

<div bind:this={container} class="gg-dropdown {className}">
	{@render trigger({ toggle, triggerProps })}
	{#if open}
		<div class="gg-dropdown__popover gg-dropdown__popover--{effectivePlacement}">
			<Menu bind:this={menuRef} id={menuId} onclose={(reason) => close(reason !== "tab")}>
				{@render children()}
			</Menu>
		</div>
	{/if}
</div>

<style>
	.gg-dropdown {
		position: relative;
		display: inline-block;
	}

	.gg-dropdown__popover {
		position: absolute;
		z-index: var(--z-dropdown);
	}

	.gg-dropdown__popover--bottom-start {
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
	}

	.gg-dropdown__popover--bottom-end {
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
	}

	.gg-dropdown__popover--top-start {
		bottom: 100%;
		left: 0;
		margin-bottom: var(--space-1);
	}

	.gg-dropdown__popover--top-end {
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
	}
</style>
