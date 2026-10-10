<script lang="ts">
	// Primer elemento enfocable: salta el marco y va directo al contenido (WCAG 2.4.1).
	import * as m from '$lib/paraglide/messages.js';
</script>

<a class="skip-link" href="#contenido">{m.common_skip_to_content()}</a>

<style>
	.skip-link {
		position: absolute;
		left: var(--space-4);
		top: var(--space-2);
		z-index: 10;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		background: var(--surface-solid-card);
		color: var(--color-text-primary);
		font-size: var(--font-size-sm);
		transform: translateY(-200%);
	}

	.skip-link:focus-visible {
		transform: none;
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
