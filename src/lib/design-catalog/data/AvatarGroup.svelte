<script lang="ts">
	/**
	 * AvatarGroup — pila de `Avatar` solapados (p. ej. "quién participa en
	 * este documento"), con recorte a `max` + un último avatar "+N" para
	 * el resto. El "+N" reutiliza el mismo par verificado que
	 * `Badge`--neutral--count (blanco sobre `--neutral-600`, ver nota de
	 * contraste en `Badge.svelte`) en vez de inventar uno nuevo.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		/** Número total de personas representadas — puede ser mayor que los `Avatar` pasados como `children` si el consumidor ya recorta la lista antes de renderizar. */
		total?: number;
		max?: number;
		size?: "xs" | "sm" | "md" | "lg" | "xl";
		children: Snippet;
		class?: string;
	}

	let { total, max = 4, size = "md", children, class: className = "" }: Props = $props();

	const SIZES = {
		xs: "var(--space-5)",
		sm: "var(--space-6)",
		md: "var(--space-8)",
		lg: "var(--space-10)",
		xl: "var(--space-12)"
	} as const;

	const FONT_SIZES: Record<keyof typeof SIZES, string> = {
		xs: "var(--text-caption-size)",
		sm: "var(--text-caption-size)",
		md: "var(--text-body-sm-size)",
		lg: "var(--text-body-size)",
		xl: "var(--text-body-lg-size)"
	};

	let dim = $derived(SIZES[size]);
	let fontSize = $derived(FONT_SIZES[size]);
	let overflow = $derived(total != null && total > max ? total - max : 0);
</script>

<div class="gg-avatar-group {className}" style={`--gg-avatar-group-overlap: calc(${dim} * -0.3);`}>
	{@render children()}
	{#if overflow > 0}
		<span
			class="gg-avatar-group__overflow"
			style={`width:${dim};height:${dim};font-size:${fontSize};`}
			role="img"
			aria-label={`Y ${overflow} más`}
		>
			+{overflow}
		</span>
	{/if}
</div>

<style>
	.gg-avatar-group {
		display: inline-flex;
		align-items: center;
	}

	.gg-avatar-group :global(.gg-avatar) {
		border: 2px solid var(--surface);
		margin-inline-start: var(--gg-avatar-group-overlap);
	}

	.gg-avatar-group > :global(.gg-avatar:first-child) {
		margin-inline-start: 0;
	}

	.gg-avatar-group__overflow {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--radius-full);
		border: 2px solid var(--surface);
		margin-inline-start: var(--gg-avatar-group-overlap);
		background: var(--neutral-600);
		color: var(--color-white);
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		line-height: 1;
	}
</style>
