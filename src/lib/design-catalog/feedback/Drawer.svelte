<script lang="ts">
	/**
	 * Drawer — panel lateral modal (candidato #6 de la ronda de
	 * ampliación post-v0.13.0, ver docs/ROADMAP.md). Mismo núcleo que
	 * `Modal`: `use:portal` + `trapFocus` (foco atrapado, Escape,
	 * restaura el foco al cerrar) — la única diferencia real es de
	 * POSICIÓN (pegado a un borde, no centrado) y de TRANSICIÓN (entra
	 * deslizando desde ese borde con `flyToken`, nuevo preset de
	 * `motion/presets.ts` — hasta ahora ningún overlay tenía entrada
	 * direccional, `Modal`/`Dialog` aparecen en el sitio sin transición).
	 *
	 * `position` decide desde qué borde entra (`end` = derecha en LTR,
	 * el valor por defecto — el lado habitual de un panel de detalle/
	 * filtros; `start` = izquierda). Mismo contrato de accesibilidad que
	 * `Modal`: `label` obligatorio (no hay título garantizado).
	 */
	import type { Snippet } from "svelte";
	import { portal } from "./portal.js";
	import { trapFocus } from "./focusTrap.js";
	import { fadeToken, flyToken } from "../motion/index.js";

	interface Props {
		open?: boolean | undefined;
		/** Nombre accesible (`aria-label`) — no hay cabecera de texto garantizada que lo sustituya. */
		label: string;
		onClose?: (() => void) | undefined;
		closeOnBackdropClick?: boolean | undefined;
		closeOnEscape?: boolean | undefined;
		position?: "start" | "end" | undefined;
		size?: "sm" | "md" | "lg" | undefined;
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
		position = "end",
		size = "md",
		class: className = "",
		style: styleProp = "",
		children
	}: Props = $props();

	let panelEl: HTMLDivElement | undefined = $state();

	function requestClose() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	function onBackdropClick(e: MouseEvent) {
		if (closeOnBackdropClick && e.target === e.currentTarget) requestClose();
	}

	$effect(() => {
		if (!open || !panelEl) return;
		return trapFocus(panelEl, { onEscape: closeOnEscape ? requestClose : undefined });
	});

	let flyX = $derived(position === "end" ? 48 : -48);
</script>

{#if open}
	<div class="gg-drawer-backdrop" role="presentation" onclick={onBackdropClick} use:portal transition:fadeToken={{ duration: "fast" }}>
		<div
			bind:this={panelEl}
			class="gg-drawer gg-drawer--{position} gg-drawer--{size} bc-glass bc-glass--immersive {className}"
			style={styleProp}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			tabindex="-1"
			transition:flyToken={{ x: flyX, duration: "normal" }}
		>
			<!-- v1.9.0: desplazamiento en un contenedor interior (ver Modal). -->
			<div class="gg-drawer__scroll">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}

<style>
	.gg-drawer-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		background: var(--overlay-backdrop);
	}

	.gg-drawer {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		height: 100%;
		max-width: calc(100vw - var(--space-8));
		overflow: hidden;
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		--bc-glass-shadow: var(--shadow-modal);
		border-inline: 1px solid var(--border);
	}

	.gg-drawer__scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}

	.gg-drawer--start {
		margin-inline-end: auto;
		border-inline-start: none;
	}

	.gg-drawer--end {
		margin-inline-start: auto;
		border-inline-end: none;
	}

	.gg-drawer--sm {
		width: var(--overlay-width-sm);
	}

	.gg-drawer--md {
		width: var(--overlay-width-md);
	}

	.gg-drawer--lg {
		width: var(--overlay-width-lg);
	}
</style>
