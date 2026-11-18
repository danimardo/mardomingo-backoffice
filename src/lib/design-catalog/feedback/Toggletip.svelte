<script lang="ts">
	/**
	 * Toggletip (ampliación 3, §26 — dejado fuera en Fase 5 junto con
	 * `Popover`/`HoverCard`, ver `docs/ROADMAP.md`) — la MISMA idea que
	 * `use:tooltip` (ampliación 1: una etiqueta de ayuda de texto, no
	 * contenido arbitrario, por eso `content` sigue siendo `string`, no
	 * un `Snippet` como en `Popover`/`HoverCard`) pero activada por
	 * CLIC/toque en vez de hover/foco, y que PERSISTE hasta que se cierra
	 * explícitamente (clic de nuevo en el disparador, clic fuera o
	 * Escape) en vez de desaparecer al retirar el ratón. Pensado para
	 * pantallas táctiles, donde no existe `hover`/`focus` sin un clic de
	 * por medio — `use:tooltip` es inalcanzable ahí sin esta alternativa.
	 *
	 * Por qué es un COMPONENTE y no una acción como `use:tooltip`: una
	 * acción no tiene forma de reaccionar a un clic FUERA del nodo sin
	 * añadir sus propios listeners de `document` (lo que `use:tooltip`
	 * evita a propósito, ver su cabecera) — aquí ese "clic fuera cierra"
	 * es justo el comportamiento que se pide, así que hace falta el
	 * mismo esqueleto abrir/cerrar que `Popover`/`DropdownMenu` (Fase 3/
	 * ampliación 1), aplicado a un panel de solo texto.
	 *
	 * `role="tooltip"` (no `"dialog"` como `Popover`) — el contenido
	 * sigue siendo texto supletorio no interactivo, mismo rol que
	 * `use:tooltip`; `aria-describedby` en el disparador apunta al panel
	 * mientras está abierto, igual que allí. Geometría de posicionamiento
	 * (cuatro direcciones + recorte a viewport) es la MISMA fórmula que
	 * `tooltip.ts`, reimplementada aquí como componente porque una acción
	 * no puede reaccionar a un `$state` de apertura controlado por clic
	 * fuera sin volver a montar el mismo tipo de listeners de `document`
	 * que este componente ya necesita de todos modos.
	 */
	import { untrack } from "svelte";
	import type { Snippet } from "svelte";

	type Placement = "top" | "bottom" | "left" | "right";

	interface TriggerProps {
		"aria-describedby": string | undefined;
		"aria-expanded": boolean;
		onclick: () => void;
	}

	interface Props {
		trigger: Snippet<[{ triggerProps: TriggerProps }]>;
		content: string;
		open?: boolean;
		placement?: Placement;
		class?: string;
	}

	let { trigger, content, open = $bindable(false), placement = "top", class: className = "" }: Props = $props();

	const uid = $props.id();
	const tipId = `${uid}-toggletip`;

	let container: HTMLDivElement | undefined = $state();
	let tipEl: HTMLDivElement | undefined = $state();
	let effectivePlacement = $state(untrack(() => placement));

	let triggerProps = $derived<TriggerProps>({
		"aria-describedby": open ? tipId : undefined,
		"aria-expanded": open,
		onclick: toggle
	});

	function focusTrigger() {
		container?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
	}

	function close(refocus: boolean) {
		if (!open) return;
		open = false;
		if (refocus) focusTrigger();
	}

	function toggle() {
		effectivePlacement = placement;
		open = !open;
	}

	// Misma fórmula de recorte/volteo que `tooltip.ts` (ampliación 1),
	// reescrita contra `$state` en vez de DOM imperativo — ver la nota de
	// cabecera sobre por qué no se comparte código entre ambas.
	function position() {
		if (!container || !tipEl) return;
		const triggerEl = container.querySelector<HTMLElement>("[aria-expanded]");
		if (!triggerEl) return;
		const gap = 6; // separación fija en px de pantalla, igual que `tooltip.ts` — ver su nota.
		const triggerRect = triggerEl.getBoundingClientRect();
		const tipRect = tipEl.getBoundingClientRect();

		let top = 0;
		let left = 0;
		if (effectivePlacement === "top") {
			top = triggerRect.top - tipRect.height - gap;
			left = triggerRect.left + (triggerRect.width - tipRect.width) / 2;
		} else if (effectivePlacement === "bottom") {
			top = triggerRect.bottom + gap;
			left = triggerRect.left + (triggerRect.width - tipRect.width) / 2;
		} else if (effectivePlacement === "left") {
			top = triggerRect.top + (triggerRect.height - tipRect.height) / 2;
			left = triggerRect.left - tipRect.width - gap;
		} else {
			top = triggerRect.top + (triggerRect.height - tipRect.height) / 2;
			left = triggerRect.right + gap;
		}

		left = Math.min(Math.max(gap, left), window.innerWidth - tipRect.width - gap);
		top = Math.min(Math.max(gap, top), window.innerHeight - tipRect.height - gap);

		tipEl.style.top = `${top}px`;
		tipEl.style.left = `${left}px`;
	}

	$effect(() => {
		if (!open) return;

		queueMicrotask(position);

		function onDocumentMousedown(e: MouseEvent) {
			if (container && !container.contains(e.target as Node)) close(false);
		}
		function onKeydown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				close(true);
			}
		}

		document.addEventListener("mousedown", onDocumentMousedown);
		document.addEventListener("keydown", onKeydown);
		return () => {
			document.removeEventListener("mousedown", onDocumentMousedown);
			document.removeEventListener("keydown", onKeydown);
		};
	});
</script>

<div bind:this={container} class="gg-toggletip {className}">
	{@render trigger({ triggerProps })}
	{#if open}
		<div bind:this={tipEl} id={tipId} role="tooltip" class="gg-toggletip__panel">
			{content}
		</div>
	{/if}
</div>

<style>
	.gg-toggletip {
		position: relative;
		display: inline-block;
	}

	.gg-toggletip__panel {
		/* A diferencia del nodo imperativo de `tooltip.ts` (que sí lleva
		   `pointer-events:none` porque es transitorio y desaparece solo al
		   retirar el ratón), este panel PERSISTE hasta que se cierra a
		   propósito — dejar los eventos de puntero activos permite
		   seleccionar/copiar su texto, y como sigue siendo descendiente de
		   `container` en el DOM (pese a `position:fixed`), un clic aquí
		   dentro no dispara el cierre por "clic fuera". */
		box-sizing: border-box;
		position: fixed;
		z-index: var(--z-tooltip);
		max-width: var(--space-64);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--surface-overlay);
		color: var(--text-primary);
		box-shadow: var(--shadow-overlay);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
	}
</style>
