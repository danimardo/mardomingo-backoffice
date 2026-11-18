<script lang="ts">
	/**
	 * Dialog (§26) — overlay MODAL estructurado: título + cuerpo +
	 * (opcional) pie de acciones. `ConfirmDialog`/`AlertDialog` del
	 * catálogo completo no son piezas propias en Fase 5 — son `Dialog`
	 * con un `footer` de botones concreto, no un patrón de interacción
	 * distinto (mismo criterio que ya evitó duplicar `Card` en 13
	 * variantes en Fase 4); `Popover`/`Tooltip`/`Toggletip`/`HoverCard`
	 * son overlays NO modales (no bloquean el resto de la página, no
	 * atrapan foco) y quedan fuera de la lista curada de Fase 5.
	 *
	 * Atrapa el foco y bloquea el scroll de fondo mientras está abierto
	 * (`focusTrap.ts`), se monta en `document.body` (`use:portal`, ver
	 * `portal.ts`) para escapar de cualquier ancestro con `transform`/
	 * `overflow` — el mismo problema de `position: fixed` que ya se
	 * resolvió una vez para `BottomNavigation` en Fase 3, esta vez de
	 * raíz.
	 */
	import type { Snippet } from "svelte";
	import { IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";
	import { portal } from "./portal.js";
	import { trapFocus } from "./focusTrap.js";

	interface Props {
		open?: boolean | undefined;
		/** Nombre accesible del diálogo (`aria-labelledby`) — se pinta como cabecera. */
		title: string;
		onClose?: (() => void) | undefined;
		closeOnBackdropClick?: boolean | undefined;
		closeOnEscape?: boolean | undefined;
		size?: "sm" | "md" | "lg" | undefined;
		footer?: Snippet | undefined;
		children?: Snippet | undefined;
	}

	let {
		open = $bindable(false),
		title,
		onClose,
		closeOnBackdropClick = true,
		closeOnEscape = true,
		size = "md",
		footer,
		children
	}: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-dialog-title`;

	let dialogEl: HTMLDivElement | undefined = $state();

	function requestClose() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	// Compara target === currentTarget en vez de `stopPropagation()` en el
	// panel interior — así el panel (que ya lleva `role="dialog"`, un rol
	// interactivo) no necesita su propio `onclick` solo para frenar la
	// burbuja, y el backdrop no necesita fingir ser un widget: con
	// `role="presentation"` queda marcado como decorativo a propósito
	// (mismo motivo por el que `DropdownMenu`, Fase 3, comprueba
	// `container.contains(e.target)` en vez de parar la propagación).
	function onBackdropClick(e: MouseEvent) {
		if (closeOnBackdropClick && e.target === e.currentTarget) requestClose();
	}

	$effect(() => {
		if (!open || !dialogEl) return;
		return trapFocus(dialogEl, { onEscape: closeOnEscape ? requestClose : undefined });
	});
</script>

{#snippet closeIcon()}
	<Icon
		name="x"
		size="1em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			body: '<path d="M4 4l8 8M12 4l-8 8" />'
		}}
	/>
{/snippet}

{#if open}
	<div class="gg-dialog-backdrop bc-anim-scrim" role="presentation" onclick={onBackdropClick} use:portal>
		<div
			bind:this={dialogEl}
			class="gg-dialog gg-dialog--{size} bc-glass bc-glass--immersive bc-anim-pop"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
		>
			<div class="gg-dialog__header">
				<h2 id={titleId} class="gg-dialog__title">{title}</h2>
				<IconButton label="Cerrar" icon={closeIcon} variant="ghost" size="sm" onclick={requestClose} />
			</div>
			<div class="gg-dialog__body">
				{@render children?.()}
			</div>
			{#if footer}
				<div class="gg-dialog__footer">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.gg-dialog-backdrop {
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

	.gg-dialog {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: calc(100vh - var(--space-8));
		overscroll-behavior: contain;
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border-radius: var(--radius-xl);
		--bc-glass-shadow: var(--shadow-modal);
		border: 1px solid var(--border);
	}

	.gg-dialog--sm {
		max-width: var(--overlay-width-sm);
	}

	.gg-dialog--md {
		max-width: var(--overlay-width-md);
	}

	.gg-dialog--lg {
		max-width: var(--overlay-width-lg);
	}

	.gg-dialog__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-5) var(--space-5) var(--space-4);
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-dialog__title {
		margin: 0;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-h5-size);
		font-weight: var(--text-h5-weight);
		line-height: var(--text-h5-leading);
	}

	.gg-dialog__body {
		padding: var(--space-5);
		overflow-y: auto;
		overscroll-behavior: contain;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}

	.gg-dialog__footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5) var(--space-5);
		border-top: 1px solid var(--border-subtle);
	}
</style>
