<script lang="ts">
	/**
	 * Modal (§26) — overlay MODAL sin estructura impuesta: a diferencia de
	 * `Dialog` (título + cuerpo + pie fijos), `Modal` es un lienzo en
	 * blanco para layouts a medida (una galería de imágenes, un asistente
	 * paso a paso con su propia cabecera visual...). Comparte el mismo
	 * núcleo de accesibilidad (`focusTrap.ts` + `use:portal`) — la única
	 * diferencia real entre las dos piezas es de composición, no de
	 * comportamiento, así que ambas reutilizan exactamente la misma
	 * lógica de foco/scroll/portal en vez de reimplementarla.
	 *
	 * Como no hay un `title` que darle a `aria-labelledby` automáticamente
	 * (el consumidor puede no querer una cabecera visual en absoluto),
	 * `label` es OBLIGATORIO — mismo criterio que `IconButton.label` en
	 * Fase 1: un diálogo modal sin nombre accesible deja a quien usa
	 * lector de pantalla sin saber en qué "ventana" está.
	 */
	import type { Snippet } from "svelte";
	import { portal } from "./portal.js";
	import { trapFocus } from "./focusTrap.js";

	interface Props {
		open?: boolean | undefined;
		/** Nombre accesible (`aria-label`) — no hay cabecera de texto garantizada que lo sustituya. */
		label: string;
		onClose?: (() => void) | undefined;
		closeOnBackdropClick?: boolean | undefined;
		closeOnEscape?: boolean | undefined;
		size?: "sm" | "md" | "lg" | "full" | undefined;
		class?: string | undefined;
		style?: string | undefined;
		children?: Snippet | undefined;
	}

	let {
		open = $bindable(false),
		label,
		onClose,
		closeOnBackdropClick = true,
		closeOnEscape = true,
		size = "md",
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let modalEl: HTMLDivElement | undefined = $state();

	function requestClose() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	// Ver el comentario equivalente en Dialog.svelte: target === currentTarget
	// en vez de `stopPropagation()` en el panel, y `role="presentation"` en
	// el backdrop para marcarlo como decorativo a propósito.
	function onBackdropClick(e: MouseEvent) {
		if (closeOnBackdropClick && e.target === e.currentTarget) requestClose();
	}

	$effect(() => {
		if (!open || !modalEl) return;
		return trapFocus(modalEl, { onEscape: closeOnEscape ? requestClose : undefined });
	});
</script>

{#if open}
	<div class="gg-modal-backdrop bc-anim-scrim" role="presentation" onclick={onBackdropClick} use:portal>
		<div
			bind:this={modalEl}
			class="gg-modal gg-modal--{size} bc-glass bc-glass--immersive bc-anim-pop {className}"
			style={styleProp}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabindex="-1"
		>
			<!-- v1.9.0: el desplazamiento vive en un contenedor interior para que
			     el cristal (pseudo-elemento de .gg-modal) cubra siempre todo el
			     panel en vez de desplazarse con el contenido. -->
			<div class="gg-modal__scroll">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	.gg-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		background: var(--overlay-backdrop);
		overscroll-behavior: contain;
	}

	.gg-modal {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: calc(100vh - var(--space-8));
		overflow: hidden;
		overscroll-behavior: contain;
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		--bc-glass-shadow: var(--shadow-modal);
		border-radius: var(--radius-xl);
		border: 1px solid var(--border);
	}

	.gg-modal__scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.gg-modal--sm {
		max-width: var(--overlay-width-sm);
	}

	.gg-modal--md {
		max-width: var(--overlay-width-md);
	}

	.gg-modal--lg {
		max-width: var(--overlay-width-lg);
	}

	.gg-modal--full {
		max-width: none;
		width: calc(100vw - var(--space-8));
		height: calc(100vh - var(--space-8));
	}
</style>
