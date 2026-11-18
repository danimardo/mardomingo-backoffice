<script lang="ts">
	/**
	 * DataCardField — una fila etiqueta/valor dentro de `DataCard`
	 * (normalmente en un `CardBody`). El valor es un `Snippet`, no solo
	 * texto — puede llevar un `DataCardStatus`, un enlace, lo que haga
	 * falta.
	 */
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		class?: string;
		children?: Snippet;
	}

	let { label, class: className = "", children }: Props = $props();
</script>

<div class="gg-data-card-field {className}">
	<span class="gg-data-card-field__label">{label}</span>
	<span class="gg-data-card-field__value">{@render children?.()}</span>
</div>

<style>
	.gg-data-card-field {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-1) 0;
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-data-card-field__label {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.gg-data-card-field__value {
		color: var(--text-primary);
		text-align: right;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
