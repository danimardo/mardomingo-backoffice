<script lang="ts">
	// Cabecera con marca y menú de cuenta. Material de cristal con alternativa opaca (DS-05, §16.10).
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
</script>

<header class="chrome" data-surface="glass">
	<a class="brand" href={resolve('/')}>{m.common_app_name()}</a>
</header>

<style>
	.chrome {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-3) var(--space-6);
		background: var(--sidebar-bg);
		border-bottom: 1px solid var(--sidebar-border);
		backdrop-filter: blur(var(--blur-sidebar));
		-webkit-backdrop-filter: blur(var(--blur-sidebar));
	}

	@supports not (backdrop-filter: blur(1px)) {
		.chrome {
			background: var(--surface-solid-chrome);
		}
	}

	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-title);
		color: var(--color-text-primary);
		text-decoration: none;
	}

	.brand:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
