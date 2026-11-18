<script lang="ts">
	/**
	 * ListItem — una fila de `List`. `<a>` si se pasa `href`, `<button>`
	 * si se pasa `onclick` sin `href`, `<div>` si no es interactiva —
	 * nunca un `<div onclick>` a mano (mismo criterio que `SidebarItem`/
	 * `BottomNavigationItem` en Fase 3: usa el elemento nativo que
	 * corresponda al comportamiento, no reimplementes su semántica).
	 */
	import type { Snippet } from "svelte";

	interface Props {
		href?: string;
		onclick?: ((e: MouseEvent) => void) | undefined;
		disabled?: boolean;
		leading?: Snippet;
		trailing?: Snippet;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { href, onclick, disabled = false, leading, trailing, class: className = "", style: styleProp = "", children }: Props = $props();
	let interactive = $derived(!!href || !!onclick);
</script>

<li class="gg-list-item {className}" style={styleProp}>
	{#snippet content()}
		{#if leading}
			<span class="gg-list-item__leading" aria-hidden="true">{@render leading()}</span>
		{/if}
		<span class="gg-list-item__content">{@render children?.()}</span>
		{#if trailing}
			<span class="gg-list-item__trailing">{@render trailing()}</span>
		{/if}
	{/snippet}

	{#if href && !disabled}
		<a {href} class="gg-list-item__row gg-list-item__row--interactive">
			{@render content()}
		</a>
	{:else if interactive}
		<button type="button" class="gg-list-item__row gg-list-item__row--interactive" {disabled} {onclick}>
			{@render content()}
		</button>
	{:else}
		<div class="gg-list-item__row">
			{@render content()}
		</div>
	{/if}
</li>

<style>
	.gg-list-item {
		box-sizing: border-box;
	}

	.gg-list-item__row {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3) var(--space-2);
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
		text-align: left;
		text-decoration: none;
	}

	.gg-list-item__row--interactive {
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.gg-list-item__row--interactive:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.gg-list-item__row--interactive:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-list-item__row:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-list-item__leading {
		display: inline-flex;
		flex-shrink: 0;
		width: var(--space-6);
		height: var(--space-6);
		align-items: center;
		justify-content: center;
	}

	.gg-list-item__content {
		flex: 1;
		min-width: 0;
	}

	.gg-list-item__trailing {
		flex-shrink: 0;
		color: var(--text-muted);
		font-size: var(--text-body-sm-size);
	}
</style>
