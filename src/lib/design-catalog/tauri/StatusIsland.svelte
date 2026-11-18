<script lang="ts">
	/**
	 * StatusIsland (v1.12.0) — barra flotante compacta para ventanas de escritorio siempre encima. Resume en una
	 * frase el estado de la app, ofrece una o dos acciones rápidas y se despliega en un panel de controles o se
	 * convierte en un aviso anclado. `mode`: `collapsed` | `expanded` | `alert`. La frase es la zona de arrastre
	 * (`data-tauri-drag-region`) y un `role="status"` con `aria-live="polite"`: cada cambio de estado se anuncia
	 * una vez. Con `opaque` la ventana mide exactamente lo que se ve (sin margen para la sombra) y lleva borde de
	 * 2 px. Con `badge`, el chevron lleva un punto de aviso y su nombre accesible lo dice.
	 * `Escape` contrae desde `expanded`; en `alert` no lo hace: el aviso decide.
	 */
	import type { Component, Snippet } from "svelte";
	import ChevronDown from "../icons/chevron-down.svelte";
	import ChevronUp from "../icons/chevron-up.svelte";
	import LoaderCircle from "../icons/loader-circle.svelte";
	import { IconButton } from "../buttons/index.js";
	import { FEEDBACK_TINT_PERCENT } from "../feedback/types.js";
	import type { FeedbackTone } from "../feedback/types.js";

	interface Props {
		title: string;
		subtitle?: string;
		tone?: FeedbackTone;
		icon: Component<{ size?: string | number; "aria-hidden"?: "true" }>;
		busy?: boolean;
		live?: boolean;
		/** Color del borde; `null` = `--border`. */
		ring?: FeedbackTone | null;
		mode?: "collapsed" | "expanded" | "alert";
		/** Ancho del contenido (CSS). */
		width?: string;
		opaque?: boolean;
		badge?: boolean;
		label?: string;
		expandLabel?: string;
		collapseLabel?: string;
		badgeLabel?: string;
		onModeChange?: (mode: "collapsed" | "expanded") => void;
		class?: string;
		meta?: Snippet;
		actions?: Snippet;
		children?: Snippet;
		alert?: Snippet;
	}

	let {
		title,
		subtitle = "",
		tone = "neutral",
		icon: Icon,
		busy = false,
		live = false,
		ring = null,
		mode = $bindable("collapsed"),
		width = "30rem",
		opaque = false,
		badge = false,
		label = "Estado",
		expandLabel = "Mostrar controles",
		collapseLabel = "Ocultar controles",
		badgeLabel = "Hay un aviso pendiente",
		onModeChange,
		class: className = "",
		meta,
		actions,
		children,
		alert,
		...rest
	}: Props = $props();

	let toneBg = $derived(tone === "neutral" ? "var(--surface-sunken)" : `color-mix(in srgb, var(--status-${tone}) ${FEEDBACK_TINT_PERCENT}%, var(--surface-raised))`);
	let toneFg = $derived(tone === "neutral" ? "var(--text-secondary)" : `var(--status-${tone})`);
	let border = $derived(ring ? `var(--status-${ring})` : opaque ? "var(--border-strong)" : "var(--border)");

	function setMode(next: "collapsed" | "expanded") {
		mode = next;
		onModeChange?.(next);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && mode === "expanded") {
			e.stopPropagation();
			setMode("collapsed");
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Escape contrae la isla (toolbar). -->
<div class="gg-island {className}" class:gg-island--opaque={opaque} role="toolbar" aria-label={label} style:--gg-island-width={width} style:--gg-island-border={border} onkeydown={onKeydown} {...rest}>
	<div class="gg-island__head">
		<span class="gg-island__indicator" class:gg-island__indicator--live={live} style:background={toneBg} style:color={toneFg} aria-hidden="true">
			{#if busy}<span class="gg-island__spin"><LoaderCircle size="1.25rem" aria-hidden="true" /></span>{:else}<Icon size="1.25rem" aria-hidden="true" />{/if}
		</span>
		<div class="gg-island__phrase" data-tauri-drag-region role="status" aria-live="polite">
			<p class="gg-island__title">{title}</p>
			{#if subtitle}<p class="gg-island__subtitle">{subtitle}</p>{/if}
		</div>
		{#if meta}<div class="gg-island__meta">{@render meta()}</div>{/if}
		{#if actions}<div class="gg-island__actions">{@render actions()}</div>{/if}
		<span class="gg-island__chevron">
			<IconButton label={badge ? `${mode === "expanded" ? collapseLabel : expandLabel}. ${badgeLabel}` : mode === "expanded" ? collapseLabel : expandLabel} variant="ghost" size="sm" aria-expanded={mode === "expanded"} onclick={() => setMode(mode === "expanded" ? "collapsed" : "expanded")}>
				{#snippet icon()}{#if mode === "expanded"}<ChevronUp size="1em" aria-hidden="true" />{:else}<ChevronDown size="1em" aria-hidden="true" />{/if}{/snippet}
			</IconButton>
			{#if badge}<span class="gg-island__badge" aria-hidden="true"></span>{/if}
		</span>
	</div>
	{#if mode === "expanded" && children}<div class="gg-island__body">{@render children()}</div>{/if}
	{#if mode === "alert" && alert}<div class="gg-island__alert">{@render alert()}</div>{/if}
</div>

<style>
	.gg-island {
		box-sizing: border-box;
		width: var(--gg-island-width);
		max-width: 100%;
		border: 1px solid var(--gg-island-border);
		border-radius: var(--radius-2xl);
		background: var(--surface-raised);
		box-shadow: var(--shadow-floating);
		font-family: var(--font-sans);
		overflow: hidden;
	}

	.gg-island--opaque {
		border-width: 2px;
		border-radius: var(--radius-md);
		box-shadow: none;
	}

	.gg-island__head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
	}

	.gg-island__indicator {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: var(--space-8);
		height: var(--space-8);
		border-radius: var(--radius-full);
	}

	.gg-island__indicator--live {
		box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 35%, transparent);
	}

	.gg-island__spin {
		display: inline-flex;
		animation: gg-island-spin 1s linear infinite;
	}

	.gg-island__phrase {
		flex: 1;
		min-width: 0;
		cursor: grab;
	}

	.gg-island__title,
	.gg-island__subtitle {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-island__title {
		color: var(--text-primary);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
	}

	.gg-island__subtitle {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}

	.gg-island__meta,
	.gg-island__actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.gg-island__chevron {
		position: relative;
		display: inline-flex;
	}

	.gg-island__badge {
		position: absolute;
		top: 0;
		right: 0;
		width: calc(var(--space-1) * 2);
		height: calc(var(--space-1) * 2);
		border-radius: var(--radius-full);
		background: var(--status-warning);
		box-shadow: 0 0 0 2px var(--surface-raised);
	}

	.gg-island__body {
		padding: 0 var(--space-4) var(--space-3);
		border-top: 1px solid var(--border-subtle);
	}

	.gg-island__alert {
		border-top: 1px solid var(--border-subtle);
	}

	@keyframes gg-island-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-island__spin {
			animation: none;
		}
	}
</style>
