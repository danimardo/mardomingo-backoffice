<script lang="ts">
	// Campo de texto (DS-10): etiqueta visible, ayuda o error enlazados con `aria-describedby`, `aria-invalid` y
	// `autocomplete`. Sin altura fija: el campo crece con el texto y la ampliación del navegador. El error se
	// indica con texto y con icono, nunca solo con color (§16.10).
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props {
		id: string;
		name: string;
		label: string;
		value?: string;
		type?: 'text' | 'email' | 'password' | 'search';
		autocomplete?: HTMLInputAttributes['autocomplete'];
		hint?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
	}

	let {
		id,
		name,
		label,
		value = $bindable(''),
		type = 'text',
		autocomplete,
		hint = '',
		error = '',
		required = false,
		disabled = false
	}: Props = $props();

	const describedBy = $derived(
		error !== '' ? `${id}-error` : hint !== '' ? `${id}-hint` : undefined
	);
</script>

<div class="field" class:disabled>
	<label class="label" for={id}>
		{label}
		{#if required}<span aria-hidden="true">*</span>{/if}
	</label>
	<input
		class="control"
		class:invalid={error !== ''}
		{id}
		{name}
		{type}
		{autocomplete}
		{required}
		{disabled}
		bind:value
		aria-invalid={error !== '' ? 'true' : undefined}
		aria-describedby={describedBy}
	/>
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
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-field);
		background: var(--surface-field);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: var(--font-size-md);
		transition:
			background var(--duration-fast) var(--ease-standard),
			border-color var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-fast) var(--ease-standard);
	}

	.control::placeholder {
		color: var(--color-field-placeholder);
	}

	.control:hover {
		background: var(--surface-field-hover);
		border-color: var(--border-field-hover);
	}

	.control:focus-visible {
		outline: none;
		border-color: var(--border-field-focus);
		box-shadow: var(--shadow-field-focus);
	}

	.control.invalid {
		border-color: var(--border-field-error);
	}

	.control.invalid:focus-visible {
		box-shadow: var(--shadow-field-error);
	}

	.control:disabled {
		background: var(--surface-field-disabled);
		opacity: 0.7;
	}

	.message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.message.error {
		color: var(--color-danger);
	}

	@media (prefers-reduced-motion: reduce) {
		.control {
			transition: none;
		}
	}
</style>
