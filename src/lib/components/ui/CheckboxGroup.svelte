<script lang="ts">
	// Estados: sin marcar por defecto; con error, el texto del error va enlazado al grupo. Teclado: casillas nativas (Tab y
	// Espacio). Temas: colores de tokens en claro y oscuro. Efectos reducidos: sin transiciones ni cristal propios.
	// Grupo de casillas (DS-06; T302). Un `fieldset` con su `legend`; ninguna casilla viene marcada salvo que el llamador la marque.
	// Cada casilla tiene su propia etiqueta. El error del grupo se anuncia con texto, nunca solo con color (§16.10).
	import Icon from './Icon.svelte';

	export interface GroupOption {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		name: string;
		legend: string;
		options: readonly GroupOption[];
		selected?: string[];
		/** Aviso o ayuda del grupo: se pinta dentro del `fieldset` y el grupo lo describe (aria-describedby). */
		description?: string;
		error?: string;
	}

	let {
		id,
		name,
		legend,
		options,
		selected = $bindable([]),
		description = '',
		error = ''
	}: Props = $props();

	const describedBy = $derived(
		[description !== '' ? `${id}-desc` : '', error !== '' ? `${id}-error` : ''].filter(
			(part) => part !== ''
		)
	);
</script>

<fieldset
	class="group"
	aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined}
>
	<legend>{legend}</legend>
	{#if description !== ''}
		<p id="{id}-desc" class="message description">{description}</p>
	{/if}
	{#each options as option (option.value)}
		<label class="option">
			<input
				type="checkbox"
				{name}
				value={option.value}
				bind:group={selected}
				aria-invalid={error !== '' ? 'true' : undefined}
			/>
			<span>{option.label}</span>
		</label>
	{/each}
	{#if error !== ''}
		<p id="{id}-error" class="message error">
			<Icon name="alert-triangle" size={16} />
			<span>{error}</span>
		</p>
	{/if}
</fieldset>

<style>
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: none;
		font-family: var(--font-ui);
	}

	legend {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
		padding: 0;
		margin-bottom: var(--space-2);
	}

	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		cursor: pointer;
	}

	.option input {
		/* 24 px: mínimo de objetivo táctil (WCAG 2.2 AA). */
		width: 1.5rem;
		height: 1.5rem;
		margin: 0;
	}

	.message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.description {
		color: var(--color-text-secondary);
	}

	.error {
		color: var(--color-danger);
	}
</style>
