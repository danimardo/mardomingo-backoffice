<script lang="ts">
	/**
	 * AnchoredAlert (v1.12.0) — aviso NO modal anclado a una superficie flotante (p. ej. la isla de
	 * `StatusIsland`). Sin velo, no atrapa el foco y no tapa la ventana de la reunión: los atajos globales
	 * siguen funcionando. Cabecera (icono de tono + título), cuerpo (`children`), una o dos acciones y, opcional,
	 * `consequence`: qué pasa si se ignora. `leading` sustituye al icono (p. ej. un `CountdownIndicator`).
	 *
	 * Semántica: `role="alertdialog"` sin `aria-modal` (o `role="status"` para avisos informativos), con
	 * `aria-labelledby`/`aria-describedby`. `initialFocus` vale `"none"` por defecto: en una reunión no se roba
	 * el foco. El color de estado vive solo en el icono (WCAG 1.4.11); título y cuerpo van en `--text-primary` /
	 * `--text-secondary`.
	 */
	import type { Component, Snippet } from "svelte";
	import Info from "../icons/info.svelte";
	import CircleCheck from "../icons/circle-check.svelte";
	import TriangleAlert from "../icons/triangle-alert.svelte";
	import CircleX from "../icons/circle-x.svelte";
	import type { FeedbackTone } from "./types.js";

	interface Props {
		tone?: Exclude<FeedbackTone, "neutral">;
		icon?: Component<{ size?: string | number; "aria-hidden"?: "true" }>;
		title: string;
		consequence?: string;
		role?: "alertdialog" | "status";
		initialFocus?: "primary" | "secondary" | "none";
		/** Densidad reducida para avisos de una sola acción. */
		dense?: boolean;
		onDismiss?: () => void;
		class?: string;
		children?: Snippet;
		actions?: Snippet;
		leading?: Snippet;
	}

	let { tone = "info", icon, title, consequence, role = "alertdialog", initialFocus = "none", dense = false, onDismiss, class: className = "", children, actions, leading, ...rest }: Props = $props();

	const uid = $props.id();
	const DEFAULT_ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleX } as const;
	let Icon = $derived(icon ?? DEFAULT_ICONS[tone]);

	let rootEl: HTMLDivElement | undefined = $state();

	// Foco inicial opcional: «primary» es la última acción (la principal va a la derecha), «secondary» la primera.
	$effect(() => {
		if (initialFocus === "none" || !rootEl) return;
		const buttons = rootEl.querySelectorAll<HTMLElement>(".gg-anchored-alert__actions button, .gg-anchored-alert__actions a");
		const target = initialFocus === "primary" ? buttons[buttons.length - 1] : buttons[0];
		queueMicrotask(() => target?.focus({ preventScroll: true }));
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && onDismiss) {
			e.stopPropagation();
			onDismiss();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Escape cierra el aviso (patrón de alertdialog). -->
<div
	bind:this={rootEl}
	class="gg-anchored-alert gg-anchored-alert--{tone} {className}"
	class:gg-anchored-alert--dense={dense}
	{role}
	aria-labelledby="{uid}-title"
	aria-describedby={children ? `${uid}-body` : undefined}
	onkeydown={onKeydown}
	{...rest}
>
	<header class="gg-anchored-alert__head">
		{#if leading}
			{@render leading()}
		{:else}
			<span class="gg-anchored-alert__icon" aria-hidden="true"><Icon size="1.25rem" aria-hidden="true" /></span>
		{/if}
		<h2 class="gg-anchored-alert__title" id="{uid}-title">{title}</h2>
	</header>
	{#if children}
		<div class="gg-anchored-alert__body" id="{uid}-body">{@render children()}</div>
	{/if}
	{#if actions}
		<div class="gg-anchored-alert__actions">{@render actions()}</div>
	{/if}
	{#if consequence}
		<p class="gg-anchored-alert__consequence">{consequence}</p>
	{/if}
</div>

<style>
	.gg-anchored-alert {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
	}

	.gg-anchored-alert--dense {
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
	}

	.gg-anchored-alert__head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.gg-anchored-alert__icon {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--status-info);
	}

	.gg-anchored-alert--success .gg-anchored-alert__icon {
		color: var(--status-success);
	}
	.gg-anchored-alert--warning .gg-anchored-alert__icon {
		color: var(--status-warning);
	}
	.gg-anchored-alert--danger .gg-anchored-alert__icon {
		color: var(--status-danger);
	}

	.gg-anchored-alert__title {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-anchored-alert__body {
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-anchored-alert__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.gg-anchored-alert__actions > :global(*) {
		flex: 1;
	}

	.gg-anchored-alert__consequence {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
	}
</style>
