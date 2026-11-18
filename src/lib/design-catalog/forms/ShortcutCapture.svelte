<script lang="ts">
	/**
	 * ShortcutCapture (v1.12.0) — campo para capturar un atajo de teclado global, con validación de conflictos.
	 * Muestra la combinación actual con `<kbd>`, un botón «Cambiar» y, en captura, «Pulsa la combinación…» con
	 * las modificadoras que se van pulsando. `Escape` cancela; `Retroceso` NO borra (evita dejar una acción sin
	 * atajo). `validate` devuelve el mensaje de conflicto o `null`; si hay conflicto NO se guarda y se conserva el
	 * valor anterior. El error se anuncia con `aria-live="assertive"`.
	 */
	import Keyboard from "../icons/keyboard.svelte";
	import { Button } from "../buttons/index.js";
	import Spinner from "../feedback/Spinner.svelte";
	import type { ControlState } from "./types.js";

	interface Props {
		/** Combinación, p. ej. `"Ctrl+Alt+M"`. */
		value?: string;
		label: string;
		capturing?: boolean;
		requireModifier?: boolean;
		validate?: (combo: string) => Promise<string | null>;
		captureText?: string;
		changeLabel?: string;
		state?: ControlState;
		disabled?: boolean;
		onchange?: (combo: string) => void;
		class?: string;
	}

	let {
		value = $bindable(""),
		label,
		capturing = $bindable(false),
		requireModifier = true,
		validate,
		captureText = "Pulsa la combinación…",
		changeLabel = "Cambiar",
		state: controlState = "default",
		disabled = false,
		onchange,
		class: className = "",
		...rest
	}: Props = $props();

	const uid = $props.id();
	let held: string[] = $state([]);
	let validating = $state(false);
	let error: string | null = $state(null);
	let fieldEl: HTMLDivElement | undefined = $state();

	let parts = $derived(value ? value.split("+") : []);

	const MODIFIERS = ["Control", "Alt", "Shift", "Meta"];

	function startCapture() {
		if (disabled) return;
		error = null;
		held = [];
		capturing = true;
		queueMicrotask(() => fieldEl?.focus());
	}

	function keyName(e: KeyboardEvent): string {
		if (e.key === " ") return "Espacio";
		return e.key.length === 1 ? e.key.toUpperCase() : e.key;
	}

	function modsOf(e: KeyboardEvent): string[] {
		const out: string[] = [];
		if (e.ctrlKey) out.push("Ctrl");
		if (e.altKey) out.push("Alt");
		if (e.shiftKey) out.push("Mayús");
		if (e.metaKey) out.push("Win");
		return out;
	}

	async function onKeydown(e: KeyboardEvent) {
		if (!capturing) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.key === "Escape") {
			capturing = false;
			held = [];
			return;
		}
		if (e.key === "Backspace") return; // no borra
		if (MODIFIERS.includes(e.key)) {
			held = modsOf(e);
			return;
		}
		const mods = modsOf(e);
		if (requireModifier && mods.length === 0) {
			error = "Usa al menos una tecla modificadora (Ctrl, Alt, Mayús o Win).";
			return;
		}
		const combo = [...mods, keyName(e)].join("+");
		capturing = false;
		held = [];
		error = null;
		if (validate) {
			validating = true;
			const conflict = await validate(combo);
			validating = false;
			if (conflict) {
				error = conflict; // no se guarda: se conserva el valor anterior
				return;
			}
		}
		value = combo;
		onchange?.(combo);
	}
</script>

<div class="gg-shortcut {className}" {...rest}>
	<div class="gg-shortcut__row">
		<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -- campo de captura de solo lectura -->
		<div
			bind:this={fieldEl}
			class="gg-shortcut__field"
			class:gg-shortcut__field--capturing={capturing}
			class:gg-shortcut__field--error={Boolean(error) || controlState === "error"}
			class:gg-shortcut__field--disabled={disabled}
			role="textbox"
			tabindex={disabled ? -1 : 0}
			aria-readonly="true"
			aria-label={capturing ? `Capturando atajo: ${label}` : `Cambiar atajo: ${label}${value ? `, ${value}` : ""}`}
			aria-invalid={Boolean(error)}
			aria-describedby={error ? `${uid}-error` : undefined}
			onkeydown={onKeydown}
			onblur={() => {
				if (capturing) {
					capturing = false;
					held = [];
				}
			}}
		>
			<span class="gg-shortcut__icon" aria-hidden="true"><Keyboard size="1.125rem" aria-hidden="true" /></span>
			{#if capturing}
				<span class="gg-shortcut__capture">
					{captureText}
					{#each held as h (h)}<kbd class="gg-shortcut__kbd">{h}</kbd>{/each}
				</span>
			{:else if validating}
				<span class="gg-shortcut__capture"><Spinner size="sm" label="Comprobando el atajo" /></span>
			{:else}
				{#each parts as p (p)}<kbd class="gg-shortcut__kbd">{p}</kbd>{/each}
			{/if}
		</div>
		<Button variant="secondary" size="sm" {disabled} onclick={startCapture}>{changeLabel}</Button>
	</div>
	<p class="gg-shortcut__error" id="{uid}-error" aria-live="assertive">{error ?? ""}</p>
</div>

<style>
	.gg-shortcut {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-sans);
	}

	.gg-shortcut__row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.gg-shortcut__field {
		box-sizing: border-box;
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--target-min, var(--space-10));
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--text-primary);
		font-size: var(--text-body-sm-size);
	}

	.gg-shortcut__field:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.gg-shortcut__field--capturing {
		border-color: var(--interactive-primary);
	}

	.gg-shortcut__field--error {
		border-color: var(--status-danger);
	}

	.gg-shortcut__field--disabled {
		color: var(--text-disabled);
		opacity: 0.6;
	}

	.gg-shortcut__icon {
		display: inline-flex;
		color: var(--text-muted);
	}

	.gg-shortcut__capture {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
		color: var(--text-secondary);
	}

	.gg-shortcut__kbd {
		padding: 0 var(--space-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-shortcut__error {
		margin: 0;
		min-height: 0;
		color: var(--text-danger);
		font-size: var(--text-caption-size);
	}

	.gg-shortcut__error:empty {
		display: none;
	}
</style>
