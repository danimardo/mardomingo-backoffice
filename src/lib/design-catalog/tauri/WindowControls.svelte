
<script lang="ts">
	/**
	 * WindowControls (§60.1) — minimizar/maximizar-restaurar/cerrar.
	 * De la lista de 60.1 (`MinimizeButton`/`MaximizeButton`/
	 * `RestoreButton`/`CloseWindowButton` por separado) se exporta un
	 * único componente que agrupa los tres, igual que `PageHeader`
	 * agrupa `PageTitle`/`PageActions`/... en vez de exportar cada trozo
	 * — el catálogo curado de §69 solo pide `WindowControls`.
	 *
	 * Puramente presentacional: no importa `@tauri-apps/*` (ver la nota
	 * de arquitectura en `tauriEnv.ts`). El consumidor cablea
	 * `onMinimize`/`onToggleMaximize`/`onClose` a
	 * `getCurrentWindow().minimize()`/`.toggleMaximize()`/`.close()` de
	 * `@tauri-apps/api/window` él mismo. `maximized` decide qué icono
	 * mostrar (maximizar vs. restaurar) — el propio consumidor lo
	 * mantiene sincronizado (p.ej. escuchando `onResized`), porque
	 * `WindowControls` no tiene forma de saberlo sin esa API.
	 *
	 * `close` es un botón normal, no `IconButton`/`Button` de Fase 1: el
	 * fondo sólido rojo de HOVER imita la convención de Windows (icono
	 * blanco sobre rojo lleno) — un par nuevo, sin equivalente ya
	 * verificado entre los variants de botón existentes (esos usan
	 * `--status-danger` como TEXTO, no como fondo sólido). Verificado
	 * abajo, con el resultado real (`--danger-600`, no `--danger-500` —
	 * ver el comentario junto a la regla).
	 */
	interface Props {
		maximized?: boolean | undefined;
		minimizeLabel?: string | undefined;
		maximizeLabel?: string | undefined;
		restoreLabel?: string | undefined;
		closeLabel?: string | undefined;
		onMinimize?: (() => void) | undefined;
		onToggleMaximize?: (() => void) | undefined;
		onClose?: (() => void) | undefined;
		class?: string | undefined;
	}

	let {
		maximized = false,
		minimizeLabel = "Minimizar",
		maximizeLabel = "Maximizar",
		restoreLabel = "Restaurar",
		closeLabel = "Cerrar",
		onMinimize,
		onToggleMaximize,
		onClose,
		class: className = ""
	}: Props = $props();
</script>

{#snippet minimizeIcon()}
	<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
		<line x1="0" y1="5" x2="10" y2="5" />
	</svg>
{/snippet}

{#snippet maximizeIcon()}
	<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1">
		<rect x="0.5" y="0.5" width="9" height="9" />
	</svg>
{/snippet}

{#snippet restoreIcon()}
	<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1">
		<rect x="2.5" y="0.5" width="7" height="7" />
		<path d="M0.5 2.5V9.5H7.5" />
	</svg>
{/snippet}

{#snippet closeIcon()}
	<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
		<line x1="0" y1="0" x2="10" y2="10" />
		<line x1="10" y1="0" x2="0" y2="10" />
	</svg>
{/snippet}

<div class="gg-window-controls {className}">
	<button type="button" class="gg-window-controls__btn" aria-label={minimizeLabel} onclick={onMinimize}>
		{@render minimizeIcon()}
	</button>
	<button type="button" class="gg-window-controls__btn" aria-label={maximized ? restoreLabel : maximizeLabel} onclick={onToggleMaximize}>
		{#if maximized}
			{@render restoreIcon()}
		{:else}
			{@render maximizeIcon()}
		{/if}
	</button>
	<button type="button" class="gg-window-controls__btn gg-window-controls__btn--close" aria-label={closeLabel} onclick={onClose}>
		{@render closeIcon()}
	</button>
</div>

<style>
	.gg-window-controls {
		display: flex;
		align-items: stretch;
		height: 100%;
	}

	.gg-window-controls__btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-12);
		border: none;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.gg-window-controls__btn:hover {
		background: var(--surface-raised);
		color: var(--text-primary);
	}

	.gg-window-controls__btn:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	/*
	 * Fondo sólido de hover/foco en `--close`, par NUEVO (no está en
	 * docs/TOKENS.md todavía) — medido primero por fórmula (mismo
	 * `relLuminance`/`contrast` de scripts/generate-tokens.mjs) y
	 * confirmado después contra `getComputedStyle()` real en
	 * scripts/verify-styleguide.mjs (Fase 7):
	 *   (valores BeCall v1.0.0) --color-white / --danger-600 (#B42318):
	 *   6.57:1 ✓ AA, comprobado por scripts/generate-tokens.mjs.
	 * Se usa --danger-600 (no --danger-500),
	 * mismo peldaño fijo de la escala (no cambia por tema) que
	 * `--surface-button-primary`/`--color-on-primary` en botones. Añadido
	 * a docs/TOKENS.md.
	 */
	.gg-window-controls__btn--close:hover,
	.gg-window-controls__btn--close:focus-visible {
		background: var(--danger-600);
		color: var(--color-white);
	}
</style>
