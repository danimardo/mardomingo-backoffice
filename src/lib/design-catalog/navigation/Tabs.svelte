<script lang="ts">
	/**
	 * Tabs (§10) — patrón WAI-ARIA Tabs: `role="tablist"` con
	 * `role="tab"` (tabindex en rueda — solo la pestaña activa es
	 * alcanzable por Tab, las demás se navegan con las flechas) y
	 * `role="tabpanel"` en paneles asociados por `aria-controls`/
	 * `aria-labelledby`. `Tabs` dibuja la lista de pestañas; el contenido
	 * de cada panel se compone aparte con `<TabPanel>` (children de
	 * `<Tabs>`), que lee la pestaña activa por contexto de Svelte en vez
	 * de que el consumidor tenga que sincronizar ids a mano.
	 *
	 * Flechas ←/→ mueven el foco Y seleccionan (activación automática,
	 * el comportamiento que recomienda el patrón ARIA para tabs de
	 * contenido, frente a la "activación manual" pensada para pestañas
	 * con carga pesada por panel).
	 *
	 * `Tabs` no fija fondo propio (se compone sobre lo que haya
	 * alrededor). El texto de la pestaña activa usa `--text-interactive`,
	 * no `--interactive-primary` (que solo pasaba AA contra `--surface`/
	 * `--surface-sunken`, 5.08:1/6.30:1 en oscuro, pero no contra
	 * `--surface-raised`, 3.87:1 — bajo AA; ver docs/TOKENS.md,
	 * "post-ampliación 3"). Esta nota decía antes "se revisará cuando
	 * Fase 4 (Card) exista" — ya existe, y `<Tabs>` pasa AA sin importar
	 * si se coloca directamente sobre una tarjeta/panel elevado o no.
	 */
	import { setContext } from "svelte";
	import type { Snippet } from "svelte";

	export interface TabItem {
		value: string;
		label: string;
		disabled?: boolean;
	}

	export interface TabsContext {
		readonly value: string;
		tabId: (v: string) => string;
		panelId: (v: string) => string;
	}

	interface Props {
		items: TabItem[];
		value?: string | undefined;
		class?: string | undefined;
		children?: Snippet | undefined;
	}

	let { items, value = $bindable(items[0]?.value ?? ""), class: className = "", children }: Props = $props();

	const uid = $props.id();
	function tabId(v: string) {
		return `${uid}-tab-${v}`;
	}
	function panelId(v: string) {
		return `${uid}-panel-${v}`;
	}

	setContext<TabsContext>("gg-tabs", {
		get value() {
			return value;
		},
		tabId,
		panelId
	});

	let tabRefs: Record<string, HTMLButtonElement> = {};

	function focusableIndex(from: number, direction: 1 | -1): number {
		let next = from;
		for (let tries = 0; tries < items.length; tries++) {
			next = (next + direction + items.length) % items.length;
			if (!items[next]?.disabled) return next;
		}
		return from;
	}

	function onKeydown(e: KeyboardEvent, currentIndex: number) {
		let nextIndex: number | null = null;
		if (e.key === "ArrowRight") nextIndex = focusableIndex(currentIndex, 1);
		else if (e.key === "ArrowLeft") nextIndex = focusableIndex(currentIndex, -1);
		else if (e.key === "Home") nextIndex = items[0]?.disabled ? focusableIndex(0, 1) : 0;
		else if (e.key === "End") nextIndex = items[items.length - 1]?.disabled ? focusableIndex(items.length - 1, -1) : items.length - 1;
		if (nextIndex === null) return;
		const target = items[nextIndex];
		if (!target) return;
		e.preventDefault();
		value = target.value;
		tabRefs[target.value]?.focus();
	}
</script>

<div class="gg-tabs {className}">
	<div role="tablist" class="gg-tabs__list">
		{#each items as item, i (item.value)}
			<button
				type="button"
				role="tab"
				id={tabId(item.value)}
				aria-controls={panelId(item.value)}
				aria-selected={value === item.value}
				tabindex={value === item.value ? 0 : -1}
				disabled={item.disabled}
				class="gg-tabs__tab bc-pressable"
				class:gg-tabs__tab--active={value === item.value}
				bind:this={tabRefs[item.value]}
				onclick={() => (value = item.value)}
				onkeydown={(e) => onKeydown(e, i)}
			>
				{item.label}
			</button>
		{/each}
	</div>
	{@render children?.()}
</div>

<style>
	.gg-tabs__list {
		display: flex;
		gap: var(--space-1);
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-tabs__tab {
		appearance: none;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--space-2) var(--space-4);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		color: var(--text-secondary);
		cursor: pointer;
		margin-bottom: -1px;
		transition:
			color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-tabs__tab:hover:not(:disabled) {
		color: var(--text-primary);
	}

	.gg-tabs__tab:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-tabs__tab--active {
		/* v1.9.0 — el subrayado de «dónde estás» es naranja corporativo
		   (--indicator-accent, ≥3:1 sobre cualquier superficie). El texto sigue
		   en --text-interactive: color + forma, nunca solo color. */
		color: var(--text-interactive);
		border-bottom-color: var(--indicator-accent);
	}

	.gg-tabs__tab:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-tabs__tab {
			transition: none;
		}
	}
</style>
