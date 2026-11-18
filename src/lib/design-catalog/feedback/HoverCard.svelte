<script lang="ts">
	/**
	 * HoverCard (ampliación 3, §26 — dejado fuera en Fase 5 junto con
	 * `Popover`/`Toggletip`, ver `docs/ROADMAP.md`) — preview enriquecido
	 * al pasar el ratón sobre un disparador (p. ej. una tarjeta de
	 * usuario al pasar sobre su nombre), contenido ARBITRARIO como
	 * `Popover` (por eso `children` es un `Snippet`, no `string` como en
	 * `Tooltip`/`Toggletip`) pero activado por HOVER en vez de clic.
	 *
	 * La diferencia real con `use:tooltip` (que también se abre en
	 * `mouseenter`) es el RETARDO: `use:tooltip` documenta explícitamente
	 * que NO lo lleva ("un retardo deliberado añadiría complejidad/
	 * inestabilidad a la verificación... sin beneficio de accesibilidad
	 * real") porque su contenido es una sola línea de texto no
	 * interactiva — aquí el contenido puede incluir enlaces/botones que
	 * el usuario quiere alcanzar moviendo el ratón DESDE el disparador
	 * HACIA el panel, así que hace falta:
	 *   - un retardo de APERTURA (`openDelay`) para no disparar en cada
	 *     paso accidental del ratón sobre el disparador;
	 *   - un retardo de CIERRE (`closeDelay`) que da tiempo a cruzar el
	 *     hueco entre disparador y panel sin que se cierre a mitad de
	 *     camino — el panel TAMBIÉN escucha `mouseenter`/`mouseleave`
	 *     propios para cancelar el cierre mientras el ratón esté dentro.
	 *
	 * `role="dialog"` sin `aria-modal` (mismo criterio que `Popover` —
	 * contenido potencialmente interactivo, no un simple texto
	 * supletorio como `role="tooltip"`). Por teclado: el foco en el
	 * disparador lo abre SIN retardo (mismo criterio que `use:tooltip` —
	 * un retardo artificial en foco sería una barrera de accesibilidad,
	 * no una mejora), Escape lo cierra y devuelve el foco al disparador,
	 * Tab NO lo cierra (mismo motivo que `Popover`: su contenido puede
	 * tener varios elementos enfocables) — se cierra cuando el foco sale
	 * de verdad tanto del disparador como del panel (`focusout` con
	 * comprobación de `relatedTarget`), no antes.
	 */
	import type { Snippet } from "svelte";
	import { untrack } from "svelte";

	type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

	interface TriggerProps {
		"aria-haspopup": "dialog";
		"aria-expanded": boolean;
		"aria-controls": string;
		onmouseenter: () => void;
		onmouseleave: () => void;
		onfocus: () => void;
		onblur: (e: FocusEvent) => void;
	}

	interface Props {
		trigger: Snippet<[{ triggerProps: TriggerProps }]>;
		label?: string;
		open?: boolean;
		placement?: Placement;
		/** Retardo de apertura en hover, en ms — sin retardo al enfocar por teclado. */
		openDelay?: number;
		/** Retardo de cierre en ms — da tiempo a cruzar el hueco hasta el panel. */
		closeDelay?: number;
		class?: string;
		children: Snippet;
	}

	let {
		trigger,
		label,
		open = $bindable(false),
		placement = "bottom-start",
		openDelay = 400,
		closeDelay = 200,
		class: className = "",
		children
	}: Props = $props();

	const uid = $props.id();
	const panelId = `${uid}-hovercard-panel`;

	let container: HTMLDivElement | undefined = $state();
	let panelEl: HTMLDivElement | undefined = $state();
	let effectivePlacement = $state(untrack(() => placement));
	let openTimer: ReturnType<typeof setTimeout> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	function clearTimers() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
		openTimer = undefined;
		closeTimer = undefined;
	}

	function openNow() {
		clearTimers();
		effectivePlacement = placement;
		open = true;
	}

	function close(refocus: boolean) {
		clearTimers();
		if (!open) return;
		open = false;
		if (refocus) container?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
	}

	function scheduleOpen() {
		if (open) {
			clearTimeout(closeTimer);
			closeTimer = undefined;
			return;
		}
		clearTimeout(closeTimer);
		closeTimer = undefined;
		openTimer = setTimeout(openNow, openDelay);
	}

	function scheduleClose() {
		clearTimeout(openTimer);
		openTimer = undefined;
		closeTimer = setTimeout(() => close(false), closeDelay);
	}

	function onTriggerFocus() {
		openNow();
	}

	function onTriggerBlur(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && panelEl?.contains(next)) return;
		close(false);
	}

	function onPanelFocusout(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && container?.contains(next)) return;
		close(false);
	}

	let triggerProps = $derived<TriggerProps>({
		"aria-haspopup": "dialog",
		"aria-expanded": open,
		"aria-controls": panelId,
		onmouseenter: scheduleOpen,
		onmouseleave: scheduleClose,
		onfocus: onTriggerFocus,
		onblur: onTriggerBlur
	});

	function flipIfNeeded() {
		if (!panelEl) return;
		const rect = panelEl.getBoundingClientRect();
		const isBottom = effectivePlacement.startsWith("bottom");
		if (isBottom && rect.bottom > window.innerHeight) {
			effectivePlacement = effectivePlacement.replace("bottom", "top") as Placement;
		} else if (!isBottom && rect.top < 0) {
			effectivePlacement = effectivePlacement.replace("top", "bottom") as Placement;
		}
	}

	$effect(() => {
		if (!open) return;
		queueMicrotask(flipIfNeeded);

		function onKeydown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				close(true);
			}
		}
		document.addEventListener("keydown", onKeydown);
		return () => document.removeEventListener("keydown", onKeydown);
	});
</script>

<div bind:this={container} class="gg-hovercard {className}">
	{@render trigger({ triggerProps })}
	{#if open}
		<div
			bind:this={panelEl}
			id={panelId}
			role="dialog"
			tabindex="-1"
			aria-label={label}
			class="gg-hovercard__panel gg-hovercard__panel--{effectivePlacement} bc-glass bc-glass--elevated bc-anim-pop"
			onmouseenter={() => {
				clearTimeout(closeTimer);
				closeTimer = undefined;
			}}
			onmouseleave={scheduleClose}
			onfocusout={onPanelFocusout}
		>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.gg-hovercard {
		position: relative;
		display: inline-block;
	}

	.gg-hovercard__panel {
		box-sizing: border-box;
		position: absolute;
		z-index: var(--z-dropdown);
		min-width: var(--space-64);
		max-width: var(--overlay-width-sm);
		padding: var(--space-4);
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-hovercard__panel--bottom-start {
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
	}

	.gg-hovercard__panel--bottom-end {
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
	}

	.gg-hovercard__panel--top-start {
		bottom: 100%;
		left: 0;
		margin-bottom: var(--space-1);
	}

	.gg-hovercard__panel--top-end {
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
	}
</style>
