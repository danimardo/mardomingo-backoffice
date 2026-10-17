<script lang="ts">
	// Aviso con texto visible (§16.10: nunca solo color). `role="alert"` para errores, `status` para lo demás.
	import type { Snippet } from 'svelte';

	type Tone = 'info' | 'success' | 'warning' | 'danger';

	interface Props {
		tone?: Tone;
		children: Snippet;
	}

	let { tone = 'info', children }: Props = $props();
	const role = $derived(tone === 'danger' ? 'alert' : 'status');
</script>

<div class="notice notice-{tone}" {role}>
	{@render children()}
</div>

<style>
	.notice {
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		color: var(--color-text-primary);
	}
	.notice-info {
		background: var(--color-info-soft);
	}
	.notice-success {
		background: var(--color-success-soft);
	}
	.notice-warning {
		background: var(--color-warning-soft);
	}
	.notice-danger {
		background: var(--color-danger-soft);
	}
</style>
