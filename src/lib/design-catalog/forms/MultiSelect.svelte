<script lang="ts">
	/**
	 * MultiSelect — selección múltiple con etiquetas dentro del propio
	 * campo (candidato #5 de la ronda de ampliación post-v0.13.0, ver
	 * docs/ROADMAP.md). Hermano de `Combobox` (mismo patrón ARIA 1.2
	 * "Combobox with List Autocomplete" — foco siempre en el `<input>`,
	 * `aria-activedescendant` en vez de mover el foco real a la lista),
	 * no una reescritura: la diferencia es que `value` es `string[]` y
	 * cada valor seleccionado se pinta como un `Chip` descartable DENTRO
	 * del campo, delante del cursor de texto.
	 *
	 * Las opciones YA seleccionadas desaparecen de la lista desplegable
	 * (no tiene sentido ofrecer otra vez lo que ya está como etiqueta) —
	 * así que no hace falta `aria-selected` por opción como en
	 * `Combobox`, todas las que se listan están sin seleccionar.
	 *
	 * Retroceso (Backspace) con el campo de texto vacío quita la ÚLTIMA
	 * etiqueta — mismo atajo que Gmail/Notion/cualquier campo de tags —
	 * sin que el usuario tenga que apuntar el ratón al icono de cierre de
	 * cada chip.
	 */
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";
	import { Chip } from "../data/index.js";

	export interface ComboboxOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		options: ComboboxOption[];
		value?: string[] | undefined;
		placeholder?: string | undefined;
		size?: ControlSize | undefined;
		state?: ControlState | undefined;
		disabled?: boolean | undefined;
		label?: string | undefined;
		/** Nombre de campo nativo — si se pasa, añade un `<input type="hidden">` POR CADA valor seleccionado (mismo `name` repetido), para que un `<form>` nativo (o `FormData.getAll(name)`) recoja la selección completa sin JS adicional — mismo patrón que `<select multiple>`. */
		name?: string | undefined;
		id?: string | undefined;
		"aria-describedby"?: string | undefined;
		noResultsLabel?: string | undefined;
		class?: string | undefined;
		style?: string | undefined;
	}

	let {
		options,
		value = $bindable([]),
		placeholder = "",
		size = "md",
		state: controlState = "default",
		disabled = false,
		label,
		name,
		id,
		"aria-describedby": describedBy,
		noResultsLabel = "Sin resultados",
		class: className = "",
		style: styleProp = ""
	}: Props = $props();

	const uid = $props.id();
	const listboxId = `${uid}-multiselect-listbox`;
	function optionId(v: string): string {
		return `${uid}-multiselect-opt-${v}`;
	}

	let query = $state("");
	let open = $state(false);
	let activeValue: string | null = $state(null);
	let container: HTMLDivElement | undefined = $state();
	let inputEl: HTMLInputElement | undefined = $state();
	let placement: "bottom" | "top" = $state("bottom");

	let selectedOptions = $derived(value.map((v) => options.find((o) => o.value === v)).filter((o): o is ComboboxOption => !!o));
	let available = $derived(options.filter((o) => !value.includes(o.value)));
	let filtered = $derived(
		query.trim() === "" ? available : available.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
	);

	function flipIfNeeded() {
		const listEl = container?.querySelector<HTMLElement>('[role="listbox"]');
		if (!listEl) return;
		const rect = listEl.getBoundingClientRect();
		if (placement === "bottom" && rect.bottom > window.innerHeight) placement = "top";
		else if (placement === "top" && rect.top < 0) placement = "bottom";
	}

	function openList() {
		if (disabled || open) return;
		open = true;
		activeValue = filtered.find((o) => !o.disabled)?.value ?? null;
		queueMicrotask(flipIfNeeded);
	}

	function closeList() {
		open = false;
		activeValue = null;
	}

	function addValue(opt: ComboboxOption) {
		if (opt.disabled) return;
		value = [...value, opt.value];
		query = "";
		activeValue = null;
		inputEl?.focus();
	}

	function removeValue(v: string) {
		value = value.filter((x) => x !== v);
		inputEl?.focus();
	}

	function removeLast() {
		if (value.length === 0) return;
		value = value.slice(0, -1);
	}

	function onInput(e: Event) {
		query = (e.target as HTMLInputElement).value;
		if (!open) openList();
		else activeValue = filtered.find((o) => !o.disabled)?.value ?? null;
	}

	function scrollActiveIntoView() {
		if (activeValue == null) return;
		document.getElementById(optionId(activeValue))?.scrollIntoView({ block: "nearest" });
	}

	function moveActive(direction: 1 | -1) {
		const enabled = filtered.filter((o) => !o.disabled);
		if (enabled.length === 0) return;
		const idx = enabled.findIndex((o) => o.value === activeValue);
		const next = idx === -1 ? (direction === 1 ? 0 : enabled.length - 1) : (idx + direction + enabled.length) % enabled.length;
		const target = enabled[next];
		if (target) activeValue = target.value;
		queueMicrotask(scrollActiveIntoView);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!open) openList();
			else moveActive(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (!open) openList();
			else moveActive(-1);
		} else if (e.key === "Enter") {
			if (open && activeValue != null) {
				e.preventDefault();
				const opt = filtered.find((o) => o.value === activeValue);
				if (opt) addValue(opt);
			}
		} else if (e.key === "Escape") {
			if (open) {
				e.preventDefault();
				closeList();
			}
		} else if (e.key === "Backspace" && query === "") {
			removeLast();
		}
	}

	function onBlur() {
		setTimeout(() => {
			if (!container || !container.contains(document.activeElement)) closeList();
		}, 0);
	}

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};border-color:${stateBorderVar(controlState)};--gg-multiselect-ring:${stateRingVar(controlState)};` + styleProp
	);
</script>

<div bind:this={container} class="gg-multiselect {className}">
	{#if name}
		{#each value as v (v)}
			<input type="hidden" {name} value={v} {disabled} />
		{/each}
	{/if}
	<!--
		role="presentation": el <span> en sí no transmite nada propio, es
		solo el área de "clic en cualquier parte del campo enfoca el
		input" — misma justificación que la pista de `Slider` (atajo de
		ratón, la función esencial ya es accesible por teclado sin pasar
		por aquí: Tab lleva directo al <input>).
	-->
	<span
		class="gg-multiselect__field-wrap"
		class:gg-multiselect__field-wrap--disabled={disabled}
		style={wrapperStyle}
		onclick={() => inputEl?.focus()}
		role="presentation"
	>
		{#each selectedOptions as opt (opt.value)}
			<Chip label={opt.label} size="sm" onRemove={disabled ? undefined : () => removeValue(opt.value)} />
		{/each}
		<input
			bind:this={inputEl}
			{id}
			type="text"
			role="combobox"
			class="gg-multiselect__field"
			aria-expanded={open}
			aria-controls={listboxId}
			aria-autocomplete="list"
			aria-activedescendant={open && activeValue != null ? optionId(activeValue) : undefined}
			aria-label={label}
			aria-describedby={describedBy}
			aria-invalid={controlState === "error" ? "true" : undefined}
			autocomplete="off"
			placeholder={selectedOptions.length === 0 ? placeholder : ""}
			{disabled}
			value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={openList}
			onblur={onBlur}
		/>
	</span>
	{#if open}
		<ul id={listboxId} role="listbox" class="gg-multiselect__listbox gg-multiselect__listbox--{placement} bc-glass-inline bc-glass--opaque bc-anim-rise">
			{#if filtered.length === 0}
				<li class="gg-multiselect__empty" role="presentation">{noResultsLabel}</li>
			{:else}
				{#each filtered as opt (opt.value)}
					<!--
						svelte-ignore a11y_click_events_have_key_events -- mismo patrón
						que Combobox: el foco se queda en el input, Intro/flechas ya
						están cubiertas allí; onclick es solo el atajo de ratón/táctil.
					-->
					<li
						id={optionId(opt.value)}
						role="option"
						aria-selected="false"
						aria-disabled={opt.disabled}
						class="gg-multiselect__option"
						class:gg-multiselect__option--active={opt.value === activeValue}
						class:gg-multiselect__option--disabled={opt.disabled}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => addValue(opt)}
					>
						{opt.label}
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.gg-multiselect {
		position: relative;
		width: 100%;
	}

	.gg-multiselect__field-wrap {
		box-sizing: border-box;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--space-10);
		padding: var(--space-1) var(--space-2);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		cursor: text;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-multiselect__field-wrap:focus-within {
		border-color: var(--gg-multiselect-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-multiselect-ring) 30%, transparent);
	}

	.gg-multiselect__field-wrap--disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-multiselect__field {
		flex: 1;
		min-width: var(--space-16);
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-body-weight);
		padding: var(--space-1) var(--space-2);
	}

	.gg-multiselect__field:disabled {
		cursor: not-allowed;
	}

	.gg-multiselect__listbox {
		position: absolute;
		left: 0;
		right: 0;
		z-index: var(--z-dropdown);
		max-height: var(--space-48);
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1);
		list-style: none;
		/* v1.9.0 — material de cristal (appearance.css): tinte y sombra como variables. */
		--bc-glass-tint: var(--surface-overlay);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		--bc-glass-shadow: var(--shadow-floating);
	}

	.gg-multiselect__listbox--bottom {
		top: 100%;
		margin-top: var(--space-1);
	}

	.gg-multiselect__listbox--top {
		bottom: 100%;
		margin-bottom: var(--space-1);
	}

	.gg-multiselect__option {
		box-sizing: border-box;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
	}

	.gg-multiselect__option--active {
		background: var(--surface-sunken);
	}

	.gg-multiselect__option--disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-multiselect__empty {
		padding: var(--space-2) var(--space-3);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-multiselect__field-wrap {
			transition: none;
		}
	}
</style>
