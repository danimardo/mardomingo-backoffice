
<script lang="ts">
	/**
	 * WindowSwitcher (§60.6) — lista de ventanas abiertas, con la actual
	 * marcada y un clic para enfocar otra. Único trozo REALMENTE
	 * presentacional del catálogo de "Multiple windows" (ver
	 * `windowManager.ts` para por qué el resto no son piezas Svelte).
	 *
	 * No importa `@tauri-apps/*` — recibe `windows`/`currentLabel` como
	 * props (el consumidor los llena con `listWindows()`/
	 * `currentWindowLabel()` de `windowManager.ts`) y `onSelect` como
	 * callback (normalmente `focusWindow(label)`).
	 *
	 * Reutiliza `Menu`/`MenuItem` (Fase 3) en vez de una lista a medida —
	 * es exactamente el mismo patrón (una lista de opciones, una
	 * seleccionable a la vez, navegable con teclado) que ya resuelven
	 * esos dos componentes.
	 */
	import Menu from "../navigation/Menu.svelte";
	import MenuItem from "../navigation/MenuItem.svelte";
	import type { WindowSummary } from "./windowManager.js";

	interface Props {
		windows: WindowSummary[];
		currentLabel?: string | null;
		onSelect?: (label: string) => void;
		class?: string;
	}

	let { windows, currentLabel = null, onSelect, class: className = "" }: Props = $props();
</script>

<Menu class={className}>
	{#each windows as win (win.label)}
		<MenuItem
			disabled={win.label === currentLabel}
			onclick={() => onSelect?.(win.label)}
		>
			<span class="gg-window-switcher__row">
				<span class="gg-window-switcher__title">{win.title || win.label}</span>
				{#if win.label === currentLabel}
					<span class="gg-window-switcher__badge">Esta ventana</span>
				{:else if win.focused}
					<span class="gg-window-switcher__badge">Activa</span>
				{/if}
			</span>
		</MenuItem>
	{/each}
</Menu>

<style>
	.gg-window-switcher__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		width: 100%;
	}

	.gg-window-switcher__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-window-switcher__badge {
		flex-shrink: 0;
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}
</style>
