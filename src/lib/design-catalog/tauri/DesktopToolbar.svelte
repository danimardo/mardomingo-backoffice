
<script lang="ts">
	/**
	 * DesktopToolbar (§60.3) — fila de botones de icono agrupados en
	 * secciones, con separador entre secciones. Del catálogo de 60.3
	 * (`ToolbarSection`/`ToolbarItem`/`ToolbarDropdown`/`ToolbarToggle`/
	 * `ToolbarOverflow`) solo `DesktopToolbar` está en la lista curada de
	 * §69 — `ToolbarSection`/`ToolbarItem` son la forma de dato
	 * (`tauri/types.ts`), `ToolbarToggle` es la prop `active` de
	 * `ToolbarItem` (mismo botón, estado `aria-pressed`), y
	 * `ToolbarDropdown`/`ToolbarOverflow` quedan fuera de Fase 7 — ya
	 * existen `DropdownMenu` (Fase 3) y el propio patrón de degradado de
	 * `ResponsiveActions` (Fase 6) para quien los necesite; añadir una
	 * pieza dedicada aquí sería duplicar esas dos, no una pieza nueva.
	 * Decisión de alcance documentada también en `docs/ROADMAP.md`.
	 *
	 * Reutiliza `IconButton` (Fase 1) para cada `ToolbarItem` — mismo
	 * criterio de "no reimplementar lo que ya existe" que `ResponsiveActions`
	 * reutilizando `Button`/`IconButton`. `active` se traduce en
	 * `aria-pressed` + un fondo distinto (mismo par `--interactive-primary`
	 * como color de icono ya verificado en `Tabs`/`Sidebar`/
	 * `BottomNavigation`, no uno nuevo).
	 */
	import IconButton from "../buttons/IconButton.svelte";
	import type { ToolbarSection } from "./types.js";

	interface Props {
		sections: ToolbarSection[];
		class?: string | undefined;
	}

	let { sections, class: className = "" }: Props = $props();
</script>

<div role="toolbar" aria-label="Barra de herramientas" class="gg-desktop-toolbar {className}">
	{#each sections as section, index (section.id)}
		{#if index > 0}
			<div class="gg-desktop-toolbar__separator" role="separator" aria-orientation="vertical"></div>
		{/if}
		<div class="gg-desktop-toolbar__section">
			{#each section.items as item (item.id)}
				<span
					class="gg-desktop-toolbar__item"
					class:gg-desktop-toolbar__item--active={item.active}
				>
					<IconButton
						label={item.label}
						icon={item.icon}
						variant="ghost"
						size="sm"
						disabled={item.disabled}
						onclick={item.onclick}
						aria-pressed={item.active}
					/>
				</span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.gg-desktop-toolbar {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.gg-desktop-toolbar__section {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.gg-desktop-toolbar__separator {
		width: 1px;
		align-self: stretch;
		margin: var(--space-1) 0;
		background: var(--border-subtle);
	}

	.gg-desktop-toolbar__item--active {
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		outline: 1px solid var(--interactive-primary);
		outline-offset: -1px;
	}
</style>
