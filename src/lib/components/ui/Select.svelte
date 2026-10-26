<script lang="ts">
	// Estados: normal, con ayuda y con error (texto e icono, enlazados con `aria-describedby`). Teclado: el `<select>` del
	// navegador, sin JavaScript. Temas: colores de tokens; el desplegable del navegador sigue su propio tema. Efectos: sin transiciones.
	// Lista desplegable nativa (DS-06; T302). Usa `<select>` del navegador: teclado y lectores de pantalla ya funcionan. Etiqueta
	// visible, ayuda o error enlazados con `aria-describedby`, y el error con texto e icono (§16.10).
	import Icon from './Icon.svelte';

	export interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		name: string;
		label: string;
		options: readonly SelectOption[];
		value?: string;
		hint?: string;
		error?: string;
		required?: boolean;
	}

	let {
		id,
		name,
		label,
		options,
		value = $bindable(''),
		hint = '',
		error = '',
		required = false
	}: Props = $props();

	const describedBy = $derived(
		error !== '' ? `${id}-error` : hint !== '' ? `${id}-hint` : undefined
	);
</script>

<div class="field">
	<label class="label" for={id}>
		{label}
		{#if required}<span aria-hidden="true">*</span>{/if}
	</label>
	<select
		class="control"
		class:invalid={error !== ''}
		{id}
		{name}
		{required}
		bind:value
		aria-invalid={error !== '' ? 'true' : undefined}
		aria-describedby={describedBy}
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error !== ''}
		<p id="{id}-error" class="message error">
			<Icon name="alert-triangle" size={16} />
			<span>{error}</span>
		</p>
	{:else if hint !== ''}
		<p id="{id}-hint" class="message">{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-family: var(--font-ui);
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}

	.control {
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		font: inherit;
		color: var(--color-text-primary);
		background: var(--color-bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}

	.control.invalid {
		border-color: var(--color-danger);
	}

	.message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.error {
		color: var(--color-danger);
	}
</style>
