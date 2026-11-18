<script lang="ts">
	// Pestañas de la landing (WAI-ARIA tabs): flechas izquierda y derecha, Inicio y Fin mueven el foco y activan; solo la
	// pestaña activa está en el orden de tabulación. Los paneles son texto, sin datos de servidor.
	interface Tab {
		id: string;
		label: string;
		title: string;
		text: string;
	}

	interface Props {
		label: string;
		tabs: readonly Tab[];
	}

	let { label, tabs }: Props = $props();
	let active = $state(0);
	let buttons = $state<HTMLButtonElement[]>([]);

	function onKey(event: KeyboardEvent): void {
		const last = tabs.length - 1;
		let next: number;
		if (event.key === 'ArrowRight') next = active === last ? 0 : active + 1;
		else if (event.key === 'ArrowLeft') next = active === 0 ? last : active - 1;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = last;
		else return;
		event.preventDefault();
		active = next;
		buttons[next]?.focus();
	}
</script>

<div class="tabs">
	<div class="list" role="tablist" aria-label={label} tabindex="-1" onkeydown={onKey}>
		{#each tabs as tab, i (tab.id)}
			<button
				bind:this={buttons[i]}
				role="tab"
				id={`tab-${tab.id}`}
				type="button"
				aria-selected={active === i}
				aria-controls={`panel-${tab.id}`}
				tabindex={active === i ? 0 : -1}
				onclick={() => (active = i)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
	{#each tabs as tab, i (tab.id)}
		<div
			role="tabpanel"
			id={`panel-${tab.id}`}
			aria-labelledby={`tab-${tab.id}`}
			hidden={active !== i}
			tabindex="0"
		>
			<h2>{tab.title}</h2>
			<p>{tab.text}</p>
		</div>
	{/each}
</div>

<style>
	.tabs {
		display: grid;
		justify-items: center;
		gap: var(--space-8);
		text-align: center;
	}

	.list {
		display: inline-flex;
		gap: var(--space-1);
		padding: var(--space-1);
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		background: var(--surface-solid-card);
	}

	button {
		min-height: 44px;
		padding: 0 var(--space-5);
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		cursor: pointer;
	}

	button[aria-selected='true'] {
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	button:focus-visible,
	[role='tabpanel']:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	h2 {
		margin: 0 0 var(--space-3);
		font-size: clamp(var(--font-size-3xl), 5vw, 3rem);
		font-weight: var(--font-weight-title);
		letter-spacing: -0.025em;
		line-height: 1.1;
		text-wrap: balance;
	}

	p {
		max-width: 36rem;
		margin: 0 auto;
		font-size: var(--font-size-lg);
		color: var(--color-text-secondary);
		text-wrap: balance;
	}
</style>
