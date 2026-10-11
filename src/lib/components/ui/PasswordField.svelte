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
	.field {
		display: grid;
		gap: 0.25rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		min-height: 2.75rem;
	}
	button {
		min-height: 2.75rem;
		min-width: 2.75rem;
	}
	.hint {
		margin: 0;
		color: var(--color-text-secondary);
	}
	.error {
		margin: 0;
		color: var(--color-danger);
	}
</style>
