<script lang="ts">
	/**
	 * Breadcrumb (§10) — `<nav aria-label="Breadcrumb"><ol>...</ol></nav>`,
	 * el patrón que recomienda WAI-ARIA (una lista ordenada dentro de un
	 * `<nav>` con nombre propio, no una `<div>` con separadores sueltos).
	 * El último elemento se marca `aria-current="page"` y NUNCA es un
	 * enlace, aunque se le pase `href` por error — ya estás en esa página.
	 */
	import type { Snippet } from "svelte";

	export interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	interface Props {
		items: BreadcrumbItem[];
		/** Por encima de este número de elementos, colapsa los del medio en "…". */
		maxItems?: number;
		separator?: Snippet;
		class?: string;
	}

	let { items, maxItems = 0, separator, class: className = "" }: Props = $props();

	// Marcador de identidad para el elemento sintético "…" insertado al
	// colapsar — no puede ser una comparación por posición/valor (los
	// índices cambian tras colapsar) ni por contenido (un item real
	// podría llamarse "…"). Un único objeto module-scope comparado por
	// referencia (`===`) es correcto pase lo que pase con los índices,
	// y evita los problemas de svelte-check al usar símbolos como clave
	// computada dentro de un tipo en el `<script>` de un componente.
	const ELLIPSIS_ITEM: BreadcrumbItem = { label: "…" };

	let visible = $derived.by((): BreadcrumbItem[] => {
		if (!maxItems || items.length <= maxItems || items.length <= 2) return items;
		// Mantiene siempre el primero y el último; colapsa los del medio en un
		// único marcador "…" no interactivo (mismo patrón que GitHub/Material).
		const head = items[0];
		const tail = items[items.length - 1];
		return head && tail ? [head, ELLIPSIS_ITEM, tail] : items;
	});
</script>

<nav aria-label="Breadcrumb" class="gg-breadcrumb {className}">
	<ol class="gg-breadcrumb__list">
		{#each visible as item, i (item.label + i)}
			{@const isLast = i === visible.length - 1}
			<li class="gg-breadcrumb__item">
				{#if i > 0}
					<span class="gg-breadcrumb__separator" aria-hidden="true">
						{#if separator}{@render separator()}{:else}/{/if}
					</span>
				{/if}
				{#if isLast}
					<span class="gg-breadcrumb__current" aria-current="page">{item.label}</span>
				{:else if item === ELLIPSIS_ITEM || !item.href}
					<span class="gg-breadcrumb__text">{item.label}</span>
				{:else}
					<a href={item.href} class="gg-breadcrumb__link">{item.label}</a>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.gg-breadcrumb__list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin: 0;
		padding: 0;
		list-style: none;
		gap: var(--space-1);
	}

	.gg-breadcrumb__item {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-breadcrumb__separator {
		color: var(--text-muted);
		display: inline-flex;
	}

	.gg-breadcrumb__link {
		color: var(--text-secondary);
		text-decoration: none;
		border-radius: var(--radius-xs);
	}

	.gg-breadcrumb__link:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.gg-breadcrumb__link:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-breadcrumb__text {
		color: var(--text-muted);
	}

	.gg-breadcrumb__current {
		color: var(--text-primary);
		font-weight: var(--text-label-weight);
	}
</style>
