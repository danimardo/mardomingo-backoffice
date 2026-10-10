<script lang="ts">
	// Selector de tema (UX-TEMA; DS-03). Es un formulario que envía a `/preferencias?/tema`: funciona sin JavaScript
	// y, con JavaScript, la página se actualiza sin recargar. La opción actual va marcada con `aria-pressed`.
	import { enhance } from '$app/forms';
	import type { Theme } from '$lib/appearance/preferences';
	import * as m from '$lib/paraglide/messages.js';
	import Button from '../ui/Button.svelte';

	interface Props {
		current: Theme;
		redirectTo: string;
	}

	let { current, redirectTo }: Props = $props();

	const options: readonly { readonly value: Theme; readonly label: () => string }[] = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	];
</script>

<form method="POST" action="/preferencias?/tema" use:enhance>
	<fieldset class="group">
		<legend>{m.theme_group()}</legend>
		<input type="hidden" name="redirectTo" value={redirectTo} />
		{#each options as option (option.value)}
			<Button
				type="submit"
				name="theme"
				value={option.value}
				variant={option.value === current ? 'primary' : 'secondary'}
				pressed={option.value === current}
			>
				{option.label()}
			</Button>
		{/each}
	</fieldset>
</form>

<style>
	.group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: none;
	}

	legend {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		color: var(--color-text-secondary);
		padding: 0;
		margin-bottom: var(--space-2);
	}
</style>
