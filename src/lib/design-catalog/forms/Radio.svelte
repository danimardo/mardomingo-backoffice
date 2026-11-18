<script lang="ts">
	/**
	 * Radio (§13) — `<input type="radio">` nativo repintado, mismo
	 * criterio que Checkbox. La exclusividad del grupo la da el navegador
	 * solo con que varios Radio compartan `name` (prop nativa, llega por
	 * `...rest`) — no hace falta que este componente sepa nada de "en qué
	 * grupo está"; `RadioGroup` (agrupación + leyenda) no está en la
	 * lista curada de la Fase 2 y queda para cuando se necesite.
	 *
	 * Svelte 5 no permite `bind:checked` en `<input type="radio">` (exige
	 * `bind:group`, pensado para "una variable, varios Radio"). Para
	 * mantener la MISMA API que Checkbox (`checked` bindable por
	 * instancia, no un `group` compartido) se usa `checked={checked}` +
	 * `onchange` en vez de la sintaxis `bind:` — el mismo efecto de doble
	 * vía, escrito a mano.
	 */
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLInputAttributes, "size" | "type" | "checked" | "class"> {
		checked?: boolean;
		size?: ControlSize;
		state?: ControlState;
		label?: string;
		class?: string;
		children?: Snippet;
	}

	let {
		checked = $bindable(false),
		size = "md",
		state = "default",
		disabled = false,
		label,
		class: className = "",
		children,
		...rest
	}: Props = $props();

	let sz = $derived(controlSizeSpec(size));
	let style = $derived(
		`--gg-box-size:${sz.controlBoxSize};` +
			`--gg-box-border:${stateBorderVar(state)};` +
			`--gg-box-ring:${stateRingVar(state)};` +
			`gap:${sz.gap};`
	);
</script>

<label
	class="gg-radio {className}"
	class:gg-radio--disabled={disabled}
	class:gg-radio--touch={size === "lg"}
	{style}
>
	<input
		type="radio"
		{checked}
		{disabled}
		class="gg-radio__input"
		{...rest}
		onchange={(e) => (checked = e.currentTarget.checked)}
	/>
	<span class="gg-radio__box" aria-hidden="true"></span>
	{#if label || children}
		<span class="gg-radio__label" style="font-size:{sz.fontSize};line-height:{sz.lineHeight};">
			{#if children}{@render children()}{:else}{label}{/if}
		</span>
	{/if}
</label>

<style>
	.gg-radio {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		font-family: var(--font-sans);
		color: var(--text-primary);
	}

	.gg-radio--disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Área de impacto táctil — ver la nota equivalente en Checkbox.svelte
	   (mismo criterio, --target-min, solo size="lg"). */
	.gg-radio--touch::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100%, var(--target-min));
		height: max(100%, var(--target-min));
		transform: translate(-50%, -50%);
	}

	.gg-radio__input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.gg-radio__box {
		box-sizing: border-box;
		width: var(--gg-box-size);
		height: var(--gg-box-size);
		flex-shrink: 0;
		border-radius: var(--radius-full);
		border: 1.5px solid var(--gg-box-border);
		background: var(--surface);
		position: relative;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			border-width var(--duration-fast) var(--easing-standard);
	}

	.gg-radio__box::after {
		content: "";
		position: absolute;
		inset: 3px;
		border-radius: var(--radius-full);
		background: var(--surface-button-primary);
		transform: scale(0);
		transition: transform var(--duration-fast) var(--easing-standard);
	}

	.gg-radio__input:checked + .gg-radio__box {
		border-color: var(--surface-button-primary);
	}

	.gg-radio__input:checked + .gg-radio__box::after {
		transform: scale(1);
	}

	.gg-radio__input:focus-visible + .gg-radio__box {
		outline: 2px solid var(--gg-box-ring);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-radio__box,
		.gg-radio__box::after {
			transition: none;
		}
	}
</style>
