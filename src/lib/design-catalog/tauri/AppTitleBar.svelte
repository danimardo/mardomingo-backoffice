
<script lang="ts">
	/**
	 * AppTitleBar (§60.1) — barra de título personalizada de una ventana
	 * Tauri. Del catálogo de 60.1 (`WindowTitle`/`WindowIcon`/
	 * `DraggableTitleRegion` por separado) solo `AppTitleBar` está en la
	 * lista curada de §69 — aquí son huecos/props de esta única pieza,
	 * mismo criterio que `PageHeader` (Fase 6) con `PageTitle`/etc.
	 *
	 * La región arrastrable (`DraggableTitleRegion`) NO necesita ningún
	 * import de `@tauri-apps/*`: Tauri reconoce el atributo HTML
	 * `data-tauri-drag-region` de forma nativa (lo intercepta su propio
	 * WebView a nivel de SO) — es un atributo de datos normal, cero
	 * JavaScript, así que encaja igual de bien en el criterio
	 * "presentacional, sin imports de Tauri" que el resto de esta
	 * carpeta. Se aplica a toda la barra EXCEPTO donde hay controles
	 * interactivos (icono si `onIconClick` existe, `actions`,
	 * `WindowControls`) — un `data-tauri-drag-region` que cubriera un
	 * botón interactivo se comería sus clics.
	 *
	 * `icon`/`title` reflejan `WindowIcon`/`WindowTitle`. `actions` es un
	 * hueco adicional para algo entre el título y los controles de
	 * ventana (p.ej. un buscador) — no está en el catálogo de 60.1 pero
	 * es la misma composición con `Snippet` ya usada en `AppShell`
	 * (Fase 6) para no forzar una forma fija.
	 */
	import type { Snippet } from "svelte";
	import WindowControls from "./WindowControls.svelte";

	interface Props {
		title: string;
		icon?: Snippet | undefined;
		actions?: Snippet | undefined;
		maximized?: boolean | undefined;
		showWindowControls?: boolean | undefined;
		onMinimize?: (() => void) | undefined;
		onToggleMaximize?: (() => void) | undefined;
		onClose?: (() => void) | undefined;
		/** v1.12.0: nombres accesibles de los botones de ventana, reenviados a `WindowControls`. */
		minimizeLabel?: string | undefined;
		maximizeLabel?: string | undefined;
		restoreLabel?: string | undefined;
		closeLabel?: string | undefined;
		class?: string | undefined;
	}

	let {
		title,
		icon,
		actions,
		maximized = false,
		showWindowControls = true,
		onMinimize,
		onToggleMaximize,
		onClose,
		minimizeLabel,
		maximizeLabel,
		restoreLabel,
		closeLabel,
		class: className = ""
	}: Props = $props();
</script>

<div class="gg-app-title-bar {className}">
	<div class="gg-app-title-bar__drag" data-tauri-drag-region>
		{#if icon}
			<span class="gg-app-title-bar__icon" aria-hidden="true">{@render icon()}</span>
		{/if}
		<span class="gg-app-title-bar__title">{title}</span>
	</div>
	{#if actions}
		<div class="gg-app-title-bar__actions">{@render actions()}</div>
	{/if}
	{#if showWindowControls}
		<WindowControls {maximized} {onMinimize} {onToggleMaximize} {onClose} {minimizeLabel} {maximizeLabel} {restoreLabel} {closeLabel} />
	{/if}
</div>

<style>
	.gg-app-title-bar {
		box-sizing: border-box;
		display: flex;
		align-items: stretch;
		height: var(--space-10);
		background: var(--surface-sunken);
		border-bottom: 1px solid var(--border);
		user-select: none;
	}

	.gg-app-title-bar__drag {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		padding-left: var(--space-3);
	}

	.gg-app-title-bar__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-4);
		height: var(--space-4);
	}

	.gg-app-title-bar__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-app-title-bar__actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-2);
	}
</style>
