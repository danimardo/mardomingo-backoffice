<script lang="ts">
	/**
	 * SelectionCard (ampliación 2, §20 — otra de las 13 variantes de
	 * `Card` dejadas fuera en Fase 4, fuera del alcance original de §69)
	 * — una tarjeta en una cuadrícula de opciones seleccionables (elegir
	 * plantilla, plan, método...), a diferencia de `ActionCard`
	 * (ampliación 1), que NAVEGA a algo en vez de marcar un estado.
	 *
	 * Semántica de BOTÓN DE ALTERNAR (`aria-pressed`), no checkbox — mismo
	 * patrón ya usado por `ToolbarItem` dentro de `DesktopToolbar` (Fase
	 * 7) para su estado "activo". Se reutiliza el vocabulario en vez de
	 * inventar uno nuevo (`aria-checked`/`role="checkbox"` habría sido
	 * igual de válido, pero un botón-alternar es más simple: no necesita
	 * simular el comportamiento de teclado de un checkbox real, `Enter`/
	 * `Espacio` sobre un `<button>` ya alternan solos).
	 *
	 * Mismo motivo que `ActionCard` para NO envolver `Card`/`Surface` en
	 * la raíz: ambas son cajas no interactivas sin `...rest`. La marca de
	 * "seleccionado" combina DOS señales, nunca una sola: el borde cambia
	 * de color (`--interactive-primary`, no textual, ya verificado ≥3:1
	 * contra `--surface-raised`/`--surface-sunken` desde Fase 1/ampliación
	 * 1) Y aparece una insignia de verificación en la esquina — el
	 * `aria-pressed` real es lo que de verdad comunica el estado a un
	 * lector de pantalla, el resto es refuerzo visual.
	 */
	import type { Snippet } from "svelte";
	import { Icon } from "../icons/index.js";

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		selected?: boolean;
		onSelectChange?: (selected: boolean) => void;
		disabled?: boolean;
		class?: string;
	}

	let { title, description, icon, selected = false, onSelectChange, disabled = false, class: className = "" }: Props = $props();
</script>

{#snippet checkIcon()}
	<Icon
		name="check"
		size="0.75em"
		tone="on-primary"
		legacySvg={{
			viewBox: "0 0 12 12",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			body: '<path d="M2.5 6.5l2.5 2.5 4.5-5.5" />'
		}}
	/>
{/snippet}

<button
	type="button"
	aria-pressed={selected}
	{disabled}
	class="gg-selection-card bc-glass-inline bc-glass--elevated bc-pressable {className}"
	class:gg-selection-card--selected={selected}
	onclick={() => onSelectChange?.(!selected)}
>
	{#if selected}
		<span class="gg-selection-card__badge" aria-hidden="true">{@render checkIcon()}</span>
	{/if}
	{#if icon}
		<span class="gg-selection-card__icon" aria-hidden="true">{@render icon()}</span>
	{/if}
	<span class="gg-selection-card__title">{title}</span>
	{#if description}
		<span class="gg-selection-card__description">{description}</span>
	{/if}
</button>

<style>
	.gg-selection-card {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		/* v1.9.0 — cristal de tarjeta (appearance.css). */
		--bc-glass-tint: var(--surface-raised);
		--bc-glass-shadow: var(--shadow-raised);
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-selection-card:hover:not(:disabled) {
		border-color: var(--border-strong);
	}

	.gg-selection-card:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-selection-card:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-selection-card--selected {
		border-color: var(--interactive-primary);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-selection-card__badge {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		border-radius: var(--radius-full);
		background: var(--surface-button-primary);
		color: var(--color-on-primary);
	}

	.gg-selection-card__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-10);
		height: var(--space-10);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--interactive-primary);
	}

	.gg-selection-card__title {
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-selection-card__description {
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-selection-card {
			transition: none;
		}
	}
</style>
