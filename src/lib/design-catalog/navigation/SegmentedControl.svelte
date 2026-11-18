<script lang="ts">
	/**
	 * SegmentedControl — alternativa compacta a `Tabs` para 2-4 opciones
	 * tipo interruptor (candidato #13 de la ronda de ampliación
	 * post-v0.13.0, ver docs/ROADMAP.md). La diferencia con `Tabs` no es
	 * solo visual: aquí no hay paneles asociados ni navegación — es un
	 * selector de UN valor entre varios, así que el patrón ARIA correcto
	 * es `role="radiogroup"`/`role="radio"` (como un grupo de Radio
	 * pintado como botones), no `tablist`/`tab` (que implica controlar
	 * contenido asociado vía `aria-controls`). Mismo roving tabindex y
	 * navegación por flechas que `Tabs` — solo Tab/Mayús-Tab entran y
	 * salen del grupo entero, las flechas mueven DENTRO de él.
	 */
	export interface SegmentedItem {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		items: SegmentedItem[];
		value?: string;
		/** Nombre accesible del grupo cuando no hay un `<FormLabel>`/encabezado visible asociado (p. ej. "Vista"). */
		label?: string;
		class?: string;
	}

	let { items, value = $bindable(items[0]?.value ?? ""), label = "Opciones", class: className = "" }: Props = $props();

	let refs: Record<string, HTMLButtonElement> = {};

	function focusableIndex(from: number, direction: 1 | -1): number {
		let next = from;
		for (let tries = 0; tries < items.length; tries++) {
			next = (next + direction + items.length) % items.length;
			if (!items[next]?.disabled) return next;
		}
		return from;
	}

	function onKeydown(e: KeyboardEvent, currentIndex: number) {
		let nextIndex: number | null = null;
		if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = focusableIndex(currentIndex, 1);
		else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIndex = focusableIndex(currentIndex, -1);
		else if (e.key === "Home") nextIndex = items[0]?.disabled ? focusableIndex(0, 1) : 0;
		else if (e.key === "End") nextIndex = items[items.length - 1]?.disabled ? focusableIndex(items.length - 1, -1) : items.length - 1;
		if (nextIndex === null) return;
		const target = items[nextIndex];
		if (!target) return;
		e.preventDefault();
		value = target.value;
		refs[target.value]?.focus();
	}
</script>

<div role="radiogroup" aria-label={label} class="gg-segmented {className}">
	{#each items as item, i (item.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === item.value}
			tabindex={value === item.value ? 0 : -1}
			disabled={item.disabled}
			class="gg-segmented__item bc-pressable"
			class:gg-segmented__item--active={value === item.value}
			bind:this={refs[item.value]}
			onclick={() => (value = item.value)}
			onkeydown={(e) => onKeydown(e, i)}
		>
			{item.label}
		</button>
	{/each}
</div>

<style>
	.gg-segmented {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}

	.gg-segmented__item {
		appearance: none;
		border: none;
		background: transparent;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	/* v1.3.1: con puntero grueso cada opción mide al menos --target-min (44 px) de alto. */
	@media (pointer: coarse) {
		.gg-segmented__item {
			min-height: var(--target-min);
		}
	}

	.gg-segmented__item:hover:not(:disabled):not(.gg-segmented__item--active) {
		color: var(--text-primary);
	}

	.gg-segmented__item:disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-segmented__item--active {
		background: var(--surface);
		color: var(--text-primary);
		box-shadow: var(--elevation-1);
	}

	.gg-segmented__item:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-segmented__item {
			transition: none;
		}
	}
</style>
