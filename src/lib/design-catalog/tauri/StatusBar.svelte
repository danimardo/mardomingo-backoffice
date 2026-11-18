
<script lang="ts">
	/**
	 * StatusBar (§60.4) — franja inferior de estado (conexión, progreso,
	 * mensaje). Del catálogo de 60.4 (`StatusBarSection`/`StatusIndicator`/
	 * `ConnectionStatus`/`ProgressStatus`/`MessageStatus`) solo `StatusBar`
	 * está en la lista curada de §69 — el resto son casos particulares de
	 * un único `StatusBarItem` (`tauri/types.ts`) con `tone`/`dot`,
	 * repartido entre `start`/`end`, mismo criterio de "una pieza, varias
	 * props" que `PageHeader`/`DesktopToolbar`.
	 *
	 * Fondo `--surface-sunken` (igual que `AppTitleBar`, mismo par
	 * texto/fondo ya verificado — ver nota de contraste en
	 * `AppTitleBar.svelte`): la barra de título arriba y la de estado
	 * abajo comparten el mismo tono "hundido" para enmarcar visualmente
	 * el `Workspace` de la aplicación, que queda en `--surface` normal —
	 * mismo criterio de "marco" que Sidebar (`--surface-sunken`) enmarca
	 * el contenido principal desde Fase 3.
	 *
	 * El punto de color de cada item (`dot`) reutiliza `--status-*` como
	 * FONDO de un círculo de 6px, no como texto — no es un par de
	 * contraste texto/fondo (no hay texto encima), así que no aplica la
	 * restricción de `--status-danger`/`--status-info` como texto sobre
	 * `--surface-raised` documentada en Fase 3 (`docs/TOKENS.md`); la
	 * ETIQUETA de cada item sigue yendo en `--text-secondary`, ya
	 * verificado sobre `--surface-sunken` (ver `AppTitleBar.svelte`).
	 */
	import type { Snippet } from "svelte";
	import type { StatusBarItem, StatusIndicatorTone } from "./types.js";

	interface Props {
		start?: StatusBarItem[];
		end?: StatusBarItem[];
		children?: Snippet;
		class?: string;
	}

	let { start = [], end = [], children, class: className = "" }: Props = $props();

	function toneVar(tone: StatusIndicatorTone | undefined): string {
		switch (tone) {
			case "success":
				return "var(--status-success)";
			case "warning":
				return "var(--status-warning)";
			case "danger":
				return "var(--status-danger)";
			case "info":
				return "var(--status-info)";
			default:
				return "var(--text-muted)";
		}
	}
</script>

{#snippet item(entry: StatusBarItem)}
	<span class="gg-status-bar__item">
		{#if entry.dot}
			<span class="gg-status-bar__dot" style={`background:${toneVar(entry.tone)};`} aria-hidden="true"></span>
		{/if}
		<span>{entry.label}</span>
	</span>
{/snippet}

<div class="gg-status-bar {className}">
	<div class="gg-status-bar__group">
		{#each start as entry (entry.id)}
			{@render item(entry)}
		{/each}
	</div>
	{#if children}
		<div class="gg-status-bar__center">{@render children()}</div>
	{/if}
	<div class="gg-status-bar__group gg-status-bar__group--end">
		{#each end as entry (entry.id)}
			{@render item(entry)}
		{/each}
	</div>
</div>

<style>
	.gg-status-bar {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		height: var(--space-8);
		padding: 0 var(--space-3);
		background: var(--surface-sunken);
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}

	.gg-status-bar__group {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-width: 0;
	}

	.gg-status-bar__group--end {
		justify-content: flex-end;
	}

	.gg-status-bar__center {
		flex: 1;
		min-width: 0;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gg-status-bar__item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		white-space: nowrap;
	}

	.gg-status-bar__dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}
</style>
