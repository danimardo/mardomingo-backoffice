<script lang="ts">
	/**
	 * Alert (§23) — aviso EN LÍNEA (no flotante: eso es `Toast`), con fondo
	 * teñido según `tone`. Del catálogo de 10 piezas de §23 (`InlineAlert`/
	 * `Banner`/`Callout`/`Notice`/`Notification`/`NotificationCenter`...)
	 * solo se construyen `Alert` y `Toast` en Fase 5 — el resto son
	 * variantes de presentación de la misma idea (una franja fija arriba
	 * de página, un recuadro más grande con imagen...) sin un patrón de
	 * interacción propio que las distinga, así que quedan fuera de la
	 * lista curada (mismo criterio que las 13 variantes de `Card` en
	 * Fase 4).
	 *
	 * Decisión de contraste (nueva en Fase 5 — ver `data/types.ts` y
	 * `docs/TOKENS.md`): el título/cuerpo NUNCA usan `--status-{tone}`
	 * como color de texto — se quedan en `--text-primary`/
	 * `--text-secondary`, siempre seguros. El color de tono vive en el
	 * icono (o el punto por defecto si no se pasa `icon`) y en una franja
	 * lateral SÓLIDA — ambos son información NO textual (WCAG 1.4.11,
	 * ≥3:1), verificados con holgura contra el propio fondo teñido.
	 */
	import type { Snippet } from "svelte";
	import { IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";
	import type { FeedbackTone } from "./types.js";
	import { FEEDBACK_TINT_PERCENT } from "./types.js";

	interface Props {
		tone?: FeedbackTone;
		/** Línea en negrita encima del cuerpo — omítela para un aviso de una sola línea. */
		title?: string;
		/** Icono de 1.25em aprox. Si se omite, se pinta un punto de color (mismo lenguaje visual que `DataCardStatus`, Fase 4). */
		icon?: Snippet;
		dismissible?: boolean;
		onDismiss?: () => void;
		class?: string;
		style?: string;
		children?: Snippet;
	}

	let { tone = "neutral", title, icon, dismissible = false, onDismiss, class: className = "", style: styleProp = "", children }: Props = $props();

	// role="alert" (asertivo, interrumpe) solo para los tonos que exigen
	// atención inmediata; el resto usa role="status" (educado) — mismo
	// criterio que separaba MenuItem "danger" del resto en Fase 3: no
	// todo aviso merece la misma urgencia para un lector de pantalla.
	let alertRole = $derived(tone === "danger" || tone === "warning" ? "alert" : "status");

	let inlineStyle = $derived(
		(tone === "neutral"
			? `background:var(--surface-sunken);border-left:3px solid var(--border-strong);`
			: `background:color-mix(in srgb, var(--status-${tone}) ${FEEDBACK_TINT_PERCENT}%, var(--surface));border-left:3px solid var(--status-${tone});`) + styleProp
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

<div class="gg-alert {className}" style={inlineStyle} role={alertRole}>
	<span class="gg-alert__icon" aria-hidden="true">
		{#if icon}
			{@render icon()}
		{:else}
			<span class="gg-alert__dot" style="background:{dotColor};"></span>
		{/if}
	</span>
	<div class="gg-alert__content">
		{#if title}
			<p class="gg-alert__title">{title}</p>
		{/if}
		{#if children}
			<div class="gg-alert__body">{@render children()}</div>
		{/if}
	</div>
	{#if dismissible}
		<IconButton label="Cerrar aviso" icon={closeIcon} size="sm" variant="ghost" class="gg-alert__dismiss" onclick={onDismiss} />
	{/if}
</div>

<style>
	.gg-alert {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
	}

	.gg-alert__icon {
		display: inline-flex;
		flex-shrink: 0;
		width: 1.25em;
		height: 1.25em;
		align-items: center;
		justify-content: center;
		margin-top: 0.15em;
	}

	.gg-alert__dot {
		width: var(--space-2);
		height: var(--space-2);
		border-radius: var(--radius-full);
	}

	.gg-alert__content {
		flex: 1;
		min-width: 0;
	}

	.gg-alert__title {
		margin: 0 0 var(--space-1);
		color: var(--text-primary);
		font-weight: var(--text-label-weight);
		font-size: var(--text-body-size);
		line-height: var(--text-body-leading);
	}

	.gg-alert__body {
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	:global(.gg-alert__dismiss) {
		flex-shrink: 0;
		margin: calc(var(--space-1) * -1);
	}
</style>
