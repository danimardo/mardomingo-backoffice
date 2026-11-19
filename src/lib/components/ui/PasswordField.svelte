<script lang="ts">
	// Campo de contraseña (UX-01): el mostrar/ocultar tiene nombre y estado (`aria-pressed`), y la regla de 8 a 128
	// caracteres es visible antes de escribir. `autocomplete` según sea nueva o actual.
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		id: string;
		name: string;
		label: string;
		autocomplete: 'current-password' | 'new-password';
		hint?: string;
		error?: string;
		required?: boolean;
	}

	let { id, name, label, autocomplete, hint = '', error = '', required = true }: Props = $props();
	let shown = $state(false);
	const describedBy = $derived(
		error !== '' ? `${id}-error` : hint !== '' ? `${id}-hint` : undefined
	);
</script>

<div class="field">
	<label class="label" for={id}>{label}</label>
	{#if hint !== ''}
		<p id="{id}-hint" class="hint">{hint}</p>
	{/if}
	<div class="row">
		<input
			{id}
			{name}
			type={shown ? 'text' : 'password'}
			{autocomplete}
			{required}
			aria-invalid={error !== '' ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
		<button type="button" aria-pressed={shown} onclick={() => (shown = !shown)}>
			{shown ? m.accounts_password_hide() : m.accounts_password_show()}
		</button>
	</div>
	{#if error !== ''}
		<p id="{id}-error" class="error">{error}</p>
	{/if}
</div>

<style>
	/* Mismos tokens de campo que TextField, para que se distinga del fondo del formulario. */
	.field {
		display: grid;
		/* minmax(0, …): el ancho intrínseco del input no ensancha la columna (sin desbordar a 320 px ni con zoom, UX-16). */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		font-family: var(--font-ui);
	}
	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	input {
		flex: 1;
		min-width: 0;
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
	input:hover {
		background: var(--surface-field-hover);
		border-color: var(--border-field-hover);
	}
	input:focus-visible {
		outline: none;
		border-color: var(--border-field-focus);
		box-shadow: var(--shadow-field-focus);
	}
	input[aria-invalid='true'] {
		border-color: var(--border-field-error);
	}
	input[aria-invalid='true']:focus-visible {
		box-shadow: var(--shadow-field-error);
	}
	button {
		min-height: 44px;
		min-width: 44px;
		padding: 0 var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-default);
		background: var(--surface-secondary);
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		cursor: pointer;
	}
	button:hover {
		background: var(--surface-secondary-hover);
		border-color: var(--border-hover);
	}
	button:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
	.hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}
	.error {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-danger);
	}
	@media (prefers-reduced-motion: reduce) {
		input {
			transition: none;
		}
	}
</style>
