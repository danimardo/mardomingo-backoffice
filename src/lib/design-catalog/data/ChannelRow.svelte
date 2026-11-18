<script lang="ts">
	/**
	 * ChannelRow (v1.12.0) — fila que resume un canal o servicio: icono con tono, título, estado en texto,
	 * control secundario (`control`, normalmente un `VolumeControl compact`) y una acción contextual (`action`).
	 * El título y el estado forman un grupo accesible. Todo valor viene por props: no conoce ningún servicio.
	 * El texto de estado usa los alias `--text-*` del tono (`--text-success`, `--text-warning`,
	 * `--text-danger`, `--text-info`; neutro, `--text-primary`): el icono y el propio texto son el segundo canal.
	 */
	import type { Component, Snippet } from "svelte";
	import type { FeedbackTone } from "../feedback/types.js";
	import { FEEDBACK_TINT_PERCENT } from "../feedback/types.js";

	interface Props {
		title: string;
		status: string;
		tone?: FeedbackTone;
		icon: Component<{ size?: string | number; "aria-hidden"?: "true" }>;
		/** Hace girar el icono (conectando, parando). */
		busy?: boolean;
		divider?: boolean;
		control?: Snippet;
		action?: Snippet;
		class?: string;
	}

	let { title, status, tone = "neutral", icon: Icon, busy = false, divider = true, control, action, class: className = "", ...rest }: Props = $props();

	let iconBg = $derived(tone === "neutral" ? "var(--surface-sunken)" : `color-mix(in srgb, var(--status-${tone}) ${FEEDBACK_TINT_PERCENT}%, var(--surface-raised))`);
	let iconFg = $derived(tone === "neutral" ? "var(--text-secondary)" : `var(--status-${tone})`);
	let statusFg = $derived(tone === "neutral" ? "var(--text-primary)" : `var(--text-${tone})`);
</script>

<div class="gg-channel-row {className}" class:gg-channel-row--divider={divider} {...rest}>
	<span class="gg-channel-row__icon" class:gg-channel-row__icon--busy={busy} style:background={iconBg} style:color={iconFg} aria-hidden="true"><Icon size="1.25rem" aria-hidden="true" /></span>
	<div class="gg-channel-row__main">
		<div role="group" aria-label="{title}: {status}" class="gg-channel-row__text">
			<p class="gg-channel-row__title">{title}</p>
			<p class="gg-channel-row__status" style:color={statusFg}>{status}</p>
		</div>
		{#if control}<div class="gg-channel-row__control">{@render control()}</div>{/if}
	</div>
	{#if action}<div class="gg-channel-row__action">{@render action()}</div>{/if}
</div>

<style>
	.gg-channel-row {
		display: grid;
		grid-template-columns: var(--space-10) 1fr auto;
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		font-family: var(--font-sans);
	}

	.gg-channel-row--divider {
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-channel-row__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-10);
		height: var(--space-10);
		border-radius: var(--radius-lg);
	}

	.gg-channel-row__icon--busy :global(svg) {
		animation: gg-channel-row-spin 1.1s linear infinite;
	}

	.gg-channel-row__main {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.gg-channel-row__title {
		margin: 0;
		color: var(--text-primary);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-sm-leading);
	}

	.gg-channel-row__status {
		margin: 0;
		font-size: var(--text-caption-size);
		font-weight: 500;
		line-height: var(--text-caption-leading);
	}

	.gg-channel-row__action {
		align-self: center;
	}

	@keyframes gg-channel-row-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-channel-row__icon--busy :global(svg) {
			animation: none;
		}
	}
</style>
