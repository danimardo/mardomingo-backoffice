<script lang="ts">
	/**
	 * Chip — etiqueta independiente (candidato #7 de la ronda de
	 * ampliación post-v0.13.0, ver docs/ROADMAP.md). Hasta ahora el único
	 * "chip" del catálogo vivía DENTRO de `FilterBar` (filtro activo
	 * descartable, sin exportarse aparte) — este es el mismo lenguaje
	 * visual pero como pieza suelta, para marcar/clasificar contenido
	 * fuera de un contexto de filtrado (una etiqueta en una fila de
	 * tabla, un tag en una tarjeta...).
	 *
	 * Mismos cinco tonos que `DataCardStatus`/`FeedbackTone` — reutiliza
	 * el vocabulario, no lo reinventa. Dos modos: solo-visualización
	 * (`onRemove` ausente) o descartable (`onRemove` presente, pinta el
	 * botón de cierre — mismo icono/patrón que el chip de `FilterBar`).
	 *
	 * Contraste: igual que `DataCardStatus`, el tono vive en el FONDO
	 * (tinte `color-mix` al mismo %12 verificado para Alert/Toast — ver
	 * `feedback/types.ts`) y el texto se queda en `--text-primary`
	 * (nunca el color de tono como texto), así que no hace falta volver
	 * a medir contraste por tono: hereda la garantía ya verificada en
	 * Fase 5.
	 */
	import { IconButton } from "../buttons/index.js";
	import { Icon } from "../icons/index.js";

	interface Props {
		label: string;
		/** v1.9.0 — "accent": etiqueta de énfasis en naranja (fondo tintado, texto neutro). */
		tone?: "success" | "warning" | "danger" | "info" | "neutral" | "accent" | undefined;
		size?: "sm" | "md" | undefined;
		onRemove?: (() => void) | undefined;
		class?: string | undefined;
	}

	let { label, tone = "neutral", size = "md", onRemove, class: className = "" }: Props = $props();
</script>

{#snippet closeIcon()}
	<Icon
		name="x"
		size="0.75em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			body: '<path d="M4 4l8 8M12 4l-8 8" />'
		}}
	/>
{/snippet}

<span
	class="gg-chip gg-chip--{tone} gg-chip--{size} {className}"
	class:gg-chip--removable={!!onRemove}
>
	<span class="gg-chip__label">{label}</span>
	{#if onRemove}
		<IconButton label={`Quitar «${label}»`} icon={closeIcon} size="sm" variant="ghost" class="gg-chip__remove" onclick={onRemove} />
	{/if}
</span>

<style>
	.gg-chip {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border-radius: var(--radius-full);
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		color: var(--text-primary);
		line-height: var(--text-body-sm-leading);
	}

	.gg-chip--md {
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-body-sm-size);
	}

	.gg-chip--md.gg-chip--removable {
		padding-inline-end: var(--space-1);
	}

	.gg-chip--sm {
		padding: 0 var(--space-2);
		font-size: var(--text-caption-size);
	}

	.gg-chip--sm.gg-chip--removable {
		padding-inline-end: 0;
	}

	.gg-chip--success {
		background: color-mix(in srgb, var(--status-success) 12%, var(--surface));
	}

	.gg-chip--warning {
		background: color-mix(in srgb, var(--status-warning) 12%, var(--surface));
	}

	.gg-chip--danger {
		background: color-mix(in srgb, var(--status-danger) 12%, var(--surface));
	}

	.gg-chip--info {
		background: color-mix(in srgb, var(--status-info) 12%, var(--surface));
	}

	.gg-chip--neutral {
		background: var(--surface-sunken);
	}

	/* v1.9.0 — énfasis: tinte naranja al 18 % con texto --text-primary
	   (verificado en generate-tokens.mjs sobre --surface y --surface-raised)
	   y un borde --indicator-accent que lo distingue sin depender del tinte. */
	.gg-chip--accent {
		background: var(--surface-accent-subtle);
		box-shadow: inset 0 0 0 1px var(--indicator-accent);
	}

	:global(.gg-chip__remove) {
		flex-shrink: 0;
	}
</style>
