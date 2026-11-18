<script lang="ts">
	/**
	 * SubmenuItem (ampliación 2, §10 — "Submenu", fuera del alcance
	 * original de §69) — un `MenuItem` que abre un `Menu` anidado en vez
	 * de disparar una acción directa. Dejado fuera en Fase 3 junto con
	 * `ContextMenu`/`MegaMenu`/`CommandMenu` por necesitar su propio
	 * patrón de teclado (ver `docs/ROADMAP.md`); esta pieza es
	 * precisamente ese patrón.
	 *
	 * NO reutiliza `<MenuItem>` tal cual: hace falta más superficie de la
	 * que expone (`aria-haspopup`/`aria-expanded`/`aria-controls`, un
	 * `onkeydown` propio para ArrowRight) y `MenuItem` no tiene `...rest`
	 * — mismo motivo, sin ampliar esa pieza de Fase 3 solo para este caso,
	 * que llevó a que `ActionCard` (ampliación 1) construyera su propio
	 * botón en vez de forzar `Surface`. El marcado interior reutiliza las
	 * MISMAS clases CSS que `MenuItem` (`gg-menu-item`) para que, visto,
	 * sea indistinguible.
	 *
	 * El panel anidado se monta con `use:portal` (Fase 5) — A PROPÓSITO
	 * fuera del DOM del `<Menu>` padre: si quedara dentro, el
	 * `querySelectorAll('[role="menuitem"]')` con el que el `Menu` padre
	 * calcula su propia lista de ↑/↓ (Fase 3, `Menu.svelte`) recogería
	 * TAMBIÉN los items del submenú abierto, rompiendo la navegación del
	 * nivel superior. Portal evita tocar `Menu.svelte` (pieza compartida
	 * por `DropdownMenu`/`ContextMenu`/`DesktopMenuBar`) solo para este
	 * caso — mismo criterio de "no ampliar una pieza compartida por una
	 * necesidad de un único consumidor" del resto del paquete.
	 *
	 * Teclado: ArrowRight (o clic/Enter/Espacio) abre y mueve el foco al
	 * primer item del submenú; ArrowLeft DENTRO del submenú lo cierra y
	 * devuelve el foco aquí (capturado en el propio panel, ya que `Menu`
	 * no gestiona ArrowLeft — no es su responsabilidad, es específica de
	 * anidar); Escape lo cierra vía el propio `onclose` de `Menu` (ya
	 * gestionado desde Fase 3); clic fuera lo cierra sin devolver el
	 * foco. Sin retraso de "intención" al pasar el ratón (ni aquí ni en
	 * `use:tooltip`, ampliación 1) — mismo criterio de determinismo sobre
	 * el confort añadido de un temporizador.
	 */
	import type { Snippet } from "svelte";
	import { portal } from "../feedback/portal.js";
	import { Icon } from "../icons/index.js";
	import Menu from "./Menu.svelte";

	interface Props {
		label: string;
		icon?: Snippet;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let { label, icon, disabled = false, class: className = "", children }: Props = $props();

	const uid = $props.id();
	const submenuId = `${uid}-submenu`;

	let triggerEl: HTMLButtonElement | undefined = $state();
	let menuEl: HTMLDivElement | undefined = $state();
	let menuRef: Menu | undefined = $state();
	let open = $state(false);

	function position() {
		if (!triggerEl || !menuEl) return;
		const tRect = triggerEl.getBoundingClientRect();
		const mRect = menuEl.getBoundingClientRect();
		const onRight = tRect.right + mRect.width <= window.innerWidth;
		menuEl.style.top = `${tRect.top}px`;
		menuEl.style.left = onRight ? `${tRect.right}px` : `${Math.max(0, tRect.left - mRect.width)}px`;
	}

	function openSubmenu() {
		if (disabled || open) return;
		open = true;
		queueMicrotask(() => {
			position();
			menuRef?.focusFirst();
		});
	}

	// v1.10.0: el panel vive en <body> (portal), así que al llevar el puntero
	// del disparador al panel salta el `mouseleave` del envoltorio. Antes eso
	// cerraba el submenú en el acto y con ratón no se podía llegar a él; ahora
	// se espera un instante y se cancela si el puntero entra en el panel (o
	// vuelve al disparador). Con teclado no cambia nada.
	const LEAVE_DELAY_MS = 120;
	let leaveTimer: ReturnType<typeof setTimeout> | undefined;

	function cancelLeave() {
		clearTimeout(leaveTimer);
		leaveTimer = undefined;
	}

	function scheduleLeave() {
		cancelLeave();
		leaveTimer = setTimeout(() => closeSubmenu(false), LEAVE_DELAY_MS);
	}

	function onWrapperEnter() {
		cancelLeave();
		openSubmenu();
	}

	$effect(() => cancelLeave);

	function closeSubmenu(refocusTrigger: boolean) {
		cancelLeave();
		if (!open) return;
		open = false;
		if (refocusTrigger) triggerEl?.focus();
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (disabled || open) return;
		if (e.key === "ArrowRight") {
			e.preventDefault();
			e.stopPropagation();
			openSubmenu();
		}
	}

	// Captura en el propio panel anidado — ArrowLeft "sale" un nivel, algo
	// que `Menu` (Fase 3) no gestiona porque solo tiene sentido al estar
	// anidado, no como menú suelto/DropdownMenu/ContextMenu.
	function onPanelKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			e.stopPropagation();
			closeSubmenu(true);
		}
	}

	$effect(() => {
		if (!open) return;
		function onDocumentMousedown(e: MouseEvent) {
			if (menuEl && !menuEl.contains(e.target as Node) && triggerEl && !triggerEl.contains(e.target as Node)) {
				closeSubmenu(false);
			}
		}
		document.addEventListener("mousedown", onDocumentMousedown);
		return () => document.removeEventListener("mousedown", onDocumentMousedown);
	});
</script>

<div class="gg-submenu-item-wrapper" role="presentation" onmouseenter={onWrapperEnter} onmouseleave={scheduleLeave}>
	<button
		bind:this={triggerEl}
		type="button"
		role="menuitem"
		tabindex="-1"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={submenuId}
		{disabled}
		class="gg-menu-item gg-submenu-item {className}"
		onclick={() => (open ? closeSubmenu(true) : openSubmenu())}
		onkeydown={onTriggerKeydown}
	>
		{#if icon}
			<span class="gg-menu-item__icon" aria-hidden="true">{@render icon()}</span>
		{/if}
		<span class="gg-menu-item__label">{label}</span>
		<Icon
			name="submenu-caret"
			class="gg-submenu-item__chevron"
			size="0.75em"
			legacySvg={{
				viewBox: "0 0 12 12",
				fill: "currentColor",
				body: '<path d="M4 2l4 4-4 4V2z" />'
			}}
		/>
	</button>
	{#if open}
		<!--
			La clase "gg-submenu-item__panel" NO es solo un gancho de estilo:
			`isInsideSubmenuPanel` (submenuPanel.ts) la usa para que
			`DropdownMenu`/`ContextMenu` reconozcan un click AQUÍ DENTRO como
			"dentro de sí mismos" pese al portal — ver ese módulo para el
			porqué (intentar cortarlo con `stopPropagation` en este mousedown
			NO basta: Svelte 5 delega ese evento, así que no impide que los
			`document.addEventListener('mousedown', ...)` del padre, otros
			registros sobre el mismo nodo, se disparen igualmente).
		-->
		<div
			bind:this={menuEl}
			class="gg-submenu-item__panel"
			role="presentation"
			onkeydown={onPanelKeydown}
			onmouseenter={cancelLeave}
			onmouseleave={scheduleLeave}
			use:portal
		>
			<Menu id={submenuId} bind:this={menuRef} onclose={(reason) => closeSubmenu(reason !== "tab")}>
				{@render children()}
			</Menu>
		</div>
	{/if}
</div>

<style>
	/*
	 * El CSS scoped de Svelte es POR COMPONENTE: usar la misma cadena de
	 * clase que `MenuItem.svelte` ("gg-menu-item") no reutiliza su
	 * estilo — cada componente lleva su propio hash de ámbito. Como
	 * `SubmenuItem` deliberadamente no envuelve `<MenuItem>` (necesita
	 * más marcado del que expone, ver la nota de cabecera), estas reglas
	 * DUPLICAN a propósito las de `MenuItem.svelte` para que, visto, sea
	 * indistinguible — si `MenuItem.svelte` cambia su apariencia base,
	 * esta copia hay que actualizarla a mano (coste aceptado a cambio de
	 * no ampliar la superficie de una pieza compartida de Fase 3 por un
	 * único consumidor).
	 */
	.gg-submenu-item-wrapper {
		position: relative;
	}

	.gg-menu-item {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}

	.gg-menu-item:hover:not(:disabled),
	.gg-menu-item:focus-visible {
		background: var(--surface-sunken);
	}

	.gg-menu-item:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-menu-item:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-menu-item__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-4);
		height: var(--space-4);
	}

	.gg-menu-item__label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.gg-submenu-item__chevron) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.gg-submenu-item__panel {
		position: fixed;
		z-index: var(--z-context-menu);
	}
</style>
