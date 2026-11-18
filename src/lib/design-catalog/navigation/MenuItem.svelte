<script lang="ts">
	/**
	 * MenuItem (§10) — `role="menuitem"`. `tabindex="-1"` siempre: el
	 * foco dentro de un menú se mueve a mano con las flechas (rueda de
	 * tabulación gestionada por `Menu`), nunca con Tab entre items.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		disabled?: boolean | undefined;
		danger?: boolean | undefined;
		icon?: Snippet | undefined;
		class?: string | undefined;
		onclick?: ((e: MouseEvent) => void) | undefined;
		children: Snippet;
	}

	let { disabled = false, danger = false, icon, class: className = "", onclick, children }: Props = $props();
</script>

<button
	type="button"
	role="menuitem"
	tabindex="-1"
	{disabled}
	class="gg-menu-item {className}"
	class:gg-menu-item--danger={danger}
	onclick={(e) => {
		if (!disabled) onclick?.(e);
	}}
>
	{#if icon}
		<span class="gg-menu-item__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<span class="gg-menu-item__label">{@render children()}</span>
</button>

<style>
	.gg-menu-item {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}

	.gg-menu-item:hover:not(:disabled),
	.gg-menu-item:focus-visible {
		background: var(--surface-sunken);
	}

	.gg-menu-item:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-menu-item:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-menu-item--danger {
		color: var(--status-danger);
	}

	.gg-menu-item__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-4);
		height: var(--space-4);
	}

	.gg-menu-item__label {
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
