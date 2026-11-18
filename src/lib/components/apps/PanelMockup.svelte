<script lang="ts">
	// Maqueta ilustrativa del panel de la cuenta (landing, W01). Es una imagen: HTML y CSS con datos de ejemplo, ocultos para
	// las tecnologías de apoyo salvo la etiqueta que avisa de que son de ejemplo. No consulta nada ni muestra datos reales.
	import * as m from '$lib/paraglide/messages.js';

	const rows = [
		{ label: m.landing_mockup_row_1, size: 'w1' },
		{ label: m.landing_mockup_row_2, size: 'w2' },
		{ label: m.landing_mockup_row_3, size: 'w3' }
	];
</script>

<div
	class="frame"
	role="img"
	aria-label={`${m.landing_mockup_title()} (${m.landing_mockup_example()})`}
>
	<div class="bar" aria-hidden="true">
		<span class="dots"><i></i><i></i><i></i></span>
		<span class="title">{m.landing_mockup_title()}</span>
		<span class="tag">{m.landing_mockup_example()}</span>
	</div>
	<div class="body" aria-hidden="true">
		<div class="balance">
			<span class="label">{m.landing_mockup_balance()}</span>
			<span class="value">{m.landing_mockup_balance_value()}</span>
		</div>
		<div class="usage">
			<span class="label">{m.landing_mockup_usage()}</span>
			{#each rows as row (row.size)}
				<div class="row">
					<span>{row.label()}</span>
					<span class="track"><span class="fill {row.size}"></span></span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.frame {
		justify-self: center;
		box-sizing: border-box;
		width: min(100%, 46rem);
		height: 15rem;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-bottom: none;
		border-radius: var(--space-6) var(--space-6) 0 0;
		background: var(--surface-solid-card);
		box-shadow: var(--shadow-card-hero);
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--border-subtle);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.dots {
		display: inline-flex;
		gap: var(--space-2);
	}

	.dots i {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--border-subtle);
	}

	.title {
		font-weight: var(--font-weight-control);
		color: var(--color-text-primary);
	}

	.tag {
		padding: 0 var(--space-3);
		border-radius: 999px;
		background: var(--hover-tint);
		font-size: var(--font-size-xs);
	}

	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		gap: var(--space-8);
		padding: var(--space-6);
	}

	.label {
		display: block;
		margin-bottom: var(--space-2);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.value {
		font-size: var(--font-size-4xl);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.03em;
		color: var(--color-text-primary);
	}

	.row {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-3);
		font-size: var(--font-size-sm);
		color: var(--color-text-primary);
	}

	.track {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--hover-tint);
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--surface-button-primary);
	}

	.w1 {
		width: 72%;
	}

	.w2 {
		width: 48%;
	}

	.w3 {
		width: 30%;
	}

	@media (max-width: 40rem) {
		.body {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}

		.row {
			grid-template-columns: 7.5rem minmax(0, 1fr);
		}
	}
</style>
