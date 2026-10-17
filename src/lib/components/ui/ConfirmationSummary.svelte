<script lang="ts">
	// Resumen de una acción destructiva antes de aplicarla (UX-13, UX-14; T302): a quién afecta, cuánto, qué cambia (antes → después)
	// y el alcance (global o por app). Solo presenta; la decisión sigue siendo la del segundo paso del formulario.
	interface Props {
		subject: string;
		amount?: string;
		before?: string;
		after?: string;
		scope: string;
	}

	let { subject, amount = '', before = '', after = '', scope }: Props = $props();
</script>

<section class="summary" aria-labelledby="resumen-titulo">
	<h2 id="resumen-titulo">Resumen antes de aplicar</h2>
	<dl>
		<dt>Usuario o elemento</dt>
		<dd>{subject}</dd>
		{#if amount !== ''}
			<dt>Importe</dt>
			<dd>{amount}</dd>
		{/if}
		{#if before !== '' || after !== ''}
			<dt>Antes → después</dt>
			<dd>{before} → {after}</dd>
		{/if}
		<dt>Alcance</dt>
		<dd>{scope}</dd>
	</dl>
</section>

<style>
	.summary {
		padding: var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
	}

	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-md);
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2) var(--space-4);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	dd {
		margin: 0;
	}
</style>
