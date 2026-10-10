<script lang="ts">
	// Ajuste propio de efectos (UX-EFECTOS; DS-05). Es un formulario a `/preferencias?/efectos`: la casilla marcada
	// pide reducir transparencia y movimiento. Sin JavaScript funciona igual que con él.
	import { enhance } from '$app/forms';
	import type { Effects } from '$lib/appearance/preferences';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '../ui/Button.svelte';

	interface Props {
		current: Effects;
		redirectTo: string;
	}

	let { current, redirectTo }: Props = $props();
</script>

<form method="POST" action="/preferencias?/efectos" use:enhance class="effects">
	<input type="hidden" name="redirectTo" value={redirectTo} />
	<label class="check">
		<input type="checkbox" name="effects" value="reduced" checked={current === 'reduced'} />
		<span>{m.appearance_effects_label()}</span>
	</label>
	<p class="hint">{m.appearance_effects_hint()}</p>
	<Button type="submit" variant="secondary">{m.appearance_save()}</Button>
</form>

<style>
	.effects {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
	}

	.check input {
		width: 20px;
		height: 20px;
		accent-color: var(--color-accent);
	}

	.hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}
</style>
