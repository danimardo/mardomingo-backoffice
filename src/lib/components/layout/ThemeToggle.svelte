<script lang="ts">
	// Selector de tema (UX-TEMA; DS-03). Es un formulario que envía a `/preferencias?/tema`: con JavaScript, la página se
	// actualiza sin recargar. Control segmentado compacto; la opción actual va marcada con `aria-pressed`.
	import { enhance } from '$app/forms';
	import type { Theme } from '$lib/appearance/preferences';
	import * as m from '$lib/paraglide/messages.js';

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
		<legend class="sr-only">{m.theme_group()}</legend>
		<input type="hidden" name="redirectTo" value={redirectTo} />
		{#each options as option (option.value)}
			<button
				type="submit"
				name="theme"
				value={option.value}
				aria-pressed={option.value === current}
				class:current={option.value === current}
			>
				{option.label()}
			</button>
		{/each}
	</fieldset>
</form>

<style>
	.group {
		display: inline-flex;
		gap: var(--space-1);
		margin: 0;
		padding: var(--space-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		background: var(--surface-solid-card);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	button {
		padding: var(--space-1) var(--space-3);
		border: none;
		border-radius: var(--radius-lg);
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-control);
		cursor: pointer;
	}

	button.current {
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	button:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
