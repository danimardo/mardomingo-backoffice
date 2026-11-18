<script lang="ts">
	/**
	 * Toast — una notificación flotante y transitoria (a diferencia de
	 * `Alert`, que vive en el flujo de la página). Pieza de presentación
	 * pura: no gestiona su propio ciclo de vida (temporizador de
	 * autocierre, apilado) — eso lo hace `toastStore.svelte.ts` +
	 * `ToastStack`. Mismo tinte/franja lateral que `Alert`, MEZCLADO
	 * sobre `--surface` (no `--surface-raised`) a propósito: se probó
	 * `--surface-raised` como base del tinte y el icono de
	 * `--status-info` en oscuro cae a 3.05:1 — prácticamente pegado al
	 * umbral de 3:1 (WCAG 1.4.11), sin margen real. Con `--surface` de
	 * base (igual que `Alert`) el mínimo medido es 3.91:1 — ver
	 * `feedback/types.ts` y `docs/TOKENS.md`. Lo "flotante" lo aporta
	 * `--shadow-floating`, no un salto de superficie.
	 */
	import { IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";
	import type { FeedbackTone } from "./types.js";
	import { FEEDBACK_TINT_PERCENT } from "./types.js";

	interface Props {
		tone?: FeedbackTone;
		title?: string | undefined;
		message: string;
		/** Si se da, se pinta un botón de cerrar. */
		onDismiss?: () => void;
		class?: string;
		style?: string;
	}

	let { tone = "neutral", title, message, onDismiss, class: className = "", style: styleProp = "" }: Props = $props();

	let alertRole = $derived(tone === "danger" || tone === "warning" ? "alert" : "status");

	let inlineStyle = $derived(
		(tone === "neutral"
			? `--bc-glass-tint:var(--surface);border-left:3px solid var(--border-strong);`
			: `--bc-glass-tint:color-mix(in srgb, var(--status-${tone}) ${FEEDBACK_TINT_PERCENT}%, var(--surface));border-left:3px solid var(--status-${tone});`) +
			styleProp
	);

	let dotColor = $derived(tone === "neutral" ? "var(--text-disabled)" : `var(--status-${tone})`);
</script>

{#snippet closeIcon()}
	<Icon
		name="x"
		size="1em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			body: '<path d="M4 4l8 8M12 4l-8 8" />'
		}}
	/>
{/snippet}

<div class="gg-toast bc-glass bc-glass--elevated bc-anim-rise {className}" style={inlineStyle} role={alertRole}>
	<span class="gg-toast__dot" aria-hidden="true" style="background:{dotColor};"></span>
	<div class="gg-toast__content">
		{#if title}
			<p class="gg-toast__title">{title}</p>
		{/if}
		<p class="gg-toast__message">{message}</p>
	</div>
	{#if onDismiss}
		<IconButton label="Cerrar notificación" icon={closeIcon} size="sm" variant="ghost" class="gg-toast__dismiss" onclick={onDismiss} />
	{/if}
</div>

<style>
	.gg-toast {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		width: 100%;
		max-width: var(--overlay-width-sm);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		/* v1.9.0 — material de cristal (appearance.css): el tinte (con el tono)
		   lo fija el estilo en línea; la sombra, aquí. */
		--bc-glass-shadow: var(--shadow-floating);
		font-family: var(--font-sans);
	}

	.gg-toast__dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
		flex-shrink: 0;
		margin-top: 0.4em;
	}

	.gg-toast__content {
		flex: 1;
		min-width: 0;
	}

	.gg-toast__title {
		margin: 0 0 var(--space-1);
		color: var(--text-primary);
		font-weight: var(--text-label-weight);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}

	.gg-toast__message {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	:global(.gg-toast__dismiss) {
		flex-shrink: 0;
		margin: calc(var(--space-1) * -1);
	}
</style>
