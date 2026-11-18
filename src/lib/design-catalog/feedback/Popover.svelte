<script lang="ts">
	/**
	 * Popover (§26, catálogo completo) — overlay NO modal con contenido
	 * ARBITRARIO (formularios, texto libre...), a diferencia de
	 * `DropdownMenu` (Fase 3), que impone semántica de menú
	 * (`role="menu"`, roving tabindex, Tab cierra). `Popover` deja que el
	 * Tab nativo recorra libremente los controles que el consumidor meta
	 * dentro — cerrarlo con Tab, como hace `DropdownMenu`, sacaría al
	 * usuario de un formulario a la primera pulsación.
	 *
	 * Mismo esqueleto de apertura/cierre que `DropdownMenu` (disparador
	 * por snippet + `triggerProps`, click fuera cierra, volteo vertical
	 * si no cabe) pero sin volver a factorizarlo en un módulo compartido
	 * — igual que `Dialog`/`Modal` comparten `focusTrap.ts` porque su
	 * comportamiento interno es IDÉNTICO, pero `DropdownMenu`/`Popover`
	 * solo se PARECEN (distinta semántica de rol, distinto criterio de
	 * cierre por teclado); forzar una abstracción común habría significado
	 * parametrizar precisamente la parte que los distingue.
	 *
	 * `role="dialog"` SIN `aria-modal` — así un lector de pantalla lo
	 * anuncia como una región con nombre propio sin tratarlo como
	 * bloqueante (no atrapa foco, no bloquea scroll de fondo, a
	 * diferencia de `Dialog`/`Modal`).
	 */
	import { untrack } from "svelte";
	import type { Snippet } from "svelte";

	type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

	interface TriggerProps {
		"aria-haspopup": "dialog";
		"aria-expanded": boolean;
		"aria-controls": string;
		onclick: () => void;
	}

	interface Props {
		trigger: Snippet<[{ toggle: () => void; triggerProps: TriggerProps }]>;
		/** Nombre accesible del panel — recomendado si el contenido no empieza con un encabezado propio. */
		label?: string;
		open?: boolean;
		placement?: Placement;
		closeOnEscape?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		trigger,
		label,
		open = $bindable(false),
		placement = "bottom-start",
		closeOnEscape = true,
		class: className = "",
		children
	}: Props = $props();

	const uid = $props.id();
	const panelId = `${uid}-popover-panel`;

	let container: HTMLDivElement | undefined = $state();
	let panelEl: HTMLDivElement | undefined = $state();
	let effectivePlacement = $state(untrack(() => placement));

	let triggerProps = $derived<TriggerProps>({
		"aria-haspopup": "dialog",
		"aria-expanded": open,
		"aria-controls": panelId,
		onclick: toggle
	});

	function focusTrigger() {
		container?.querySelector<HTMLElement>('[aria-haspopup="dialog"]')?.focus();
	}

	function openPopover() {
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
		else openPopover();
	}

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

		queueMicrotask(() => {
			panelEl?.querySelector<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
			flipIfNeeded();
		});

		function onDocumentMousedown(e: MouseEvent) {
			if (container && !container.contains(e.target as Node)) close(false);
		}
		function onKeydown(e: KeyboardEvent) {
			if (e.key === "Escape" && closeOnEscape) {
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

<div bind:this={container} class="gg-popover {className}">
	{@render trigger({ toggle, triggerProps })}
	{#if open}
		<div class="gg-popover__panel gg-popover__panel--{effectivePlacement} bc-glass bc-glass--elevated bc-anim-pop" bind:this={panelEl} id={panelId} role="dialog" aria-label={label}>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.gg-popover {
		position: relative;
		display: inline-block;
	}

	.gg-popover__panel {
		box-sizing: border-box;
		position: absolute;
		z-index: var(--z-dropdown);
		min-width: var(--space-64);
		padding: var(--space-4);
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-popover__panel--bottom-start {
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
	}

	.gg-popover__panel--bottom-end {
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
	}

	.gg-popover__panel--top-start {
		bottom: 100%;
		left: 0;
		margin-bottom: var(--space-1);
	}

	.gg-popover__panel--top-end {
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
	}
</style>
