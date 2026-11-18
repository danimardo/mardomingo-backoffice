<script lang="ts">
	/**
	 * ActionCard (§20, catálogo completo) — otra de las 13 variantes de
	 * `Card` dejadas fuera en Fase 4: una tarjeta ENTERA clicable
	 * (icono + título + descripción + chevron), para una cuadrícula de
	 * accesos directos ("Crear servidor", "Ver informes"...).
	 *
	 * NO envuelve `Card`/`Surface` en la raíz: ambas son cajas NO
	 * interactivas (sin `...rest`, así que no hay forma de pasarles
	 * `href`/`type` reenviados) — mismo motivo, sin tocar `Surface` de
	 * Fase 1 para ampliar su superficie solo por esto, que llevó a que
	 * `SidebarItem`/`ListItem` (Fase 3/4) construyeran su propio
	 * elemento raíz `<a>`/`<button>` en vez de envolver un primitivo no
	 * interactivo. El resultado replica los mismos tokens visuales que
	 * `Card` por defecto (`--shadow-raised`, `--radius-lg`, `--border`)
	 * para que, vista, sea indistinguible de una `Card` normal.
	 *
	 * Usa `hoverLift` (Fase 8, `motion/actions.ts`) para el levantamiento
	 * al pasar el ratón — reutilizado tal cual en vez de escribir una
	 * transición CSS nueva: ya respeta `prefers-reduced-motion` y ya usa
	 * los tokens de motion correctos, mismo criterio de "no reinventar
	 * lo que otra fase ya resolvió y verificó" de todo el paquete.
	 */
	import type { Snippet } from "svelte";
	import { Icon } from "../icons/index.js";
	import { hoverLift } from "../motion/actions.js";

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		class?: string;
	}

	let { title, description, icon, href, onclick, disabled = false, class: className = "" }: Props = $props();
</script>

{#snippet content()}
	{#if icon}
		<span class="gg-action-card__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<span class="gg-action-card__text">
		<span class="gg-action-card__title">{title}</span>
		{#if description}
			<span class="gg-action-card__description">{description}</span>
		{/if}
	</span>
	<Icon
		name="chevron-right"
		class="gg-action-card__chevron"
		size="1em"
		legacySvg={{
			viewBox: "0 0 16 16",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			body: '<path d="M6 3l5 5-5 5" />'
		}}
	/>
{/snippet}

{#if href && !disabled}
	<a {href} class="gg-action-card bc-glass-inline bc-glass--elevated {className}" use:hoverLift>
		{@render content()}
	</a>
{:else}
	<button type="button" {disabled} class="gg-action-card bc-glass-inline bc-glass--elevated {className}" {onclick} use:hoverLift>
		{@render content()}
	</button>
{/if}

<style>
	.gg-action-card {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		/* v1.9.0 — cristal de tarjeta (appearance.css): tinte y sombra como
		   variables; con efectos reducidos o apagados, la tarjeta opaca. */
		--bc-glass-tint: var(--surface-raised);
		--bc-glass-shadow: var(--shadow-raised);
		color: inherit;
		text-decoration: none;
		text-align: left;
		cursor: pointer;
		transition:
			box-shadow var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard);
	}

	.gg-action-card:hover:not(:disabled) {
		border-color: var(--border-strong);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-action-card:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-action-card:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-action-card__icon {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: var(--space-10);
		height: var(--space-10);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--interactive-primary);
	}

	.gg-action-card__text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}

	.gg-action-card__title {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-action-card__description {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	:global(.gg-action-card__chevron) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-action-card {
			transition: none;
		}
	}
</style>
