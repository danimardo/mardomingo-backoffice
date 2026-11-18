<script lang="ts">
	/**
	 * SidebarItem — una fila de navegación: icono + etiqueta, estado
	 * activo. `<a>` si se pasa `href` (navegación real, `aria-current`
	 * correcto), `<button>` si no (acción sin URL propia). En modo
	 * colapsado la etiqueta se oculta visualmente pero el `title` nativo
	 * la sigue ofreciendo al pasar el ratón, y el nombre accesible no
	 * cambia — nunca depende solo de que el icono "se entienda".
	 */
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";
	import type { SidebarContext } from "./Sidebar.svelte";

	interface Props {
		label: string;
		icon?: Snippet;
		href?: string;
		active?: boolean;
		disabled?: boolean;
		class?: string;
		onclick?: (e: MouseEvent) => void;
	}

	let { label, icon, href, active = false, disabled = false, class: className = "", onclick }: Props = $props();
	const ctx = getContext<SidebarContext>("gg-sidebar");
</script>

{#snippet content()}
	{#if icon}
		<span class="gg-sidebar-item__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<span class="gg-sidebar-item__label" class:gg-sidebar-item__label--hidden={ctx?.collapsed}>{label}</span>
{/snippet}

{#if href && !disabled}
	<a
		{href}
		title={ctx?.collapsed ? label : undefined}
		aria-current={active ? "page" : undefined}
		class="gg-sidebar-item bc-pressable {className}"
		class:gg-sidebar-item--active={active}
	>
		{@render content()}
	</a>
{:else}
	<button
		type="button"
		title={ctx?.collapsed ? label : undefined}
		aria-pressed={active}
		{disabled}
		class="gg-sidebar-item bc-pressable {className}"
		class:gg-sidebar-item--active={active}
		{onclick}
	>
		{@render content()}
	</button>
{/if}

<style>
	.gg-sidebar-item {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-decoration: none;
		cursor: pointer;
		text-align: left;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-sidebar-item:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-sidebar-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-sidebar-item--active {
		/* 10%, no 16%: el texto --interactive-primary sobre este fondo
		   compuesto (se mezcla con lo que haya detrás, el --surface de
		   Sidebar) verificado a mano — a 16% baja a 4.28:1 en oscuro
		   (bajo AA), a 10% queda en 4.55:1. */
		background: color-mix(in srgb, var(--surface-button-primary) 10%, transparent);
		color: var(--interactive-primary);
		/* v1.9.0 — barra naranja de «dónde estás» en el borde de inicio
		   (--indicator-accent, ≥3:1): forma además de color. */
		box-shadow: inset var(--indicator-thickness) 0 0 var(--indicator-accent);
	}

	.gg-sidebar-item:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-sidebar-item__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-5);
		height: var(--space-5);
	}

	.gg-sidebar-item__label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-sidebar-item__label--hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-sidebar-item {
			transition: none;
		}
	}
</style>
