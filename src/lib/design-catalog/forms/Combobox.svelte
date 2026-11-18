<script lang="ts">
	/**
	 * Combobox — campo de texto con sugerencias filtradas, selección
	 * única (candidato #3 de la ronda de ampliación post-v0.13.0, ver
	 * docs/ROADMAP.md). `Select.svelte` deja escrito desde Fase 2 por qué
	 * no se construyó entonces ("semanas de trabajo hechas bien, o una
	 * réplica que PARECE accesible y no lo es hecha rápido") — esta
	 * ronda SÍ es ese trabajo, con el patrón completo:
	 *
	 * Patrón WAI-ARIA 1.2 "Combobox with List Autocomplete" — el foco
	 * NUNCA se mueve del `<input>` (a diferencia de `Tabs`/
	 * `SegmentedControl`, que sí mueven el foco real entre botones): la
	 * opción resaltada se comunica con `aria-activedescendant`, no con
	 * `tabindex` rotatorio. `role="combobox"` + `aria-expanded`/
	 * `aria-controls`/`aria-autocomplete="list"` en el input,
	 * `role="listbox"`/`role="option"` + `aria-selected` en la lista.
	 *
	 * Posicionamiento del popover: mismo método ya probado en
	 * `DropdownMenu` (relative+absolute, `getBoundingClientRect` para
	 * voltear si no cabe) — sin librería de posicionamiento, sin volver a
	 * inventar la técnica.
	 */
	import { Icon } from "../icons/index.js";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	export interface ComboboxOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		options: ComboboxOption[];
		value?: string | null;
		placeholder?: string;
		size?: ControlSize;
		state?: ControlState;
		disabled?: boolean;
		/** Nombre accesible cuando no hay un `<FormLabel for={id}>` asociado — si se omite, se asume que sí lo hay (mismo contrato que `Input`). */
		label?: string;
		/** Nombre de campo nativo — si se pasa, añade un `<input type="hidden">` con el VALOR real (no el texto de búsqueda del campo visible) para que un `<form>` nativo (o `FormData`) recoja `value` sin JS adicional, igual que ya podían `Input`/`NumberInput`/`Select`. */
		name?: string;
		id?: string;
		"aria-describedby"?: string;
		noResultsLabel?: string;
		class?: string;
		style?: string;
	}

	let {
		options,
		value = $bindable(null),
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
	const listboxId = `${uid}-combobox-listbox`;
	function optionId(v: string): string {
		return `${uid}-combobox-opt-${v}`;
	}

	let query = $state("");
	let open = $state(false);
	let activeValue: string | null = $state(null);
	let container: HTMLDivElement | undefined = $state();
	let placement: "bottom" | "top" = $state("bottom");

	let selectedOption = $derived(options.find((o) => o.value === value) ?? null);

	$effect(() => {
		if (!open) query = selectedOption?.label ?? "";
	});

	let filtered = $derived(
		query.trim() === "" || (selectedOption != null && query === selectedOption.label)
			? options
			: options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
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

	function selectOption(opt: ComboboxOption) {
		if (opt.disabled) return;
		value = opt.value;
		query = opt.label;
		closeList();
	}

	function onInput(e: Event) {
		query = (e.target as HTMLInputElement).value;
		if (query.trim() === "") value = null;
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
				if (opt) selectOption(opt);
			}
		} else if (e.key === "Escape") {
			if (open) {
				e.preventDefault();
				closeList();
				query = selectedOption?.label ?? "";
			}
		}
	}

	function onBlur() {
		setTimeout(() => {
			if (!container || !container.contains(document.activeElement)) {
				closeList();
				query = selectedOption?.label ?? "";
			}
		}, 0);
	}

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};border-color:${stateBorderVar(controlState)};--gg-combobox-ring:${stateRingVar(controlState)};` + styleProp
	);
	let fieldStyle = $derived(`padding:${sz.paddingY} ${sz.paddingX};font-size:${sz.fontSize};line-height:${sz.lineHeight};`);
</script>

<div bind:this={container} class="gg-combobox {className}">
	{#if name}
		<input type="hidden" {name} value={value ?? ""} {disabled} />
	{/if}
	<span class="gg-combobox__field-wrap" class:gg-combobox__field-wrap--disabled={disabled} style={wrapperStyle}>
		<input
			{id}
			type="text"
			role="combobox"
			class="gg-combobox__field"
			style={fieldStyle}
			aria-expanded={open}
			aria-controls={listboxId}
			aria-autocomplete="list"
			aria-activedescendant={open && activeValue != null ? optionId(activeValue) : undefined}
			aria-label={label}
			aria-describedby={describedBy}
			aria-invalid={controlState === "error" ? "true" : undefined}
			autocomplete="off"
			{placeholder}
			{disabled}
			value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={openList}
			onblur={onBlur}
		/>
		<Icon
			name="chevron-down"
			class="gg-combobox__chevron"
			size={16}
			legacySvg={{
				viewBox: "0 0 16 16",
				fill: "none",
				body: '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 6l4 4 4-4" />'
			}}
		/>
	</span>
	{#if open}
		<ul id={listboxId} role="listbox" class="gg-combobox__listbox gg-combobox__listbox--{placement} bc-glass-inline bc-glass--opaque bc-anim-rise">
			{#if filtered.length === 0}
				<li class="gg-combobox__empty" role="presentation">{noResultsLabel}</li>
			{:else}
				{#each filtered as opt (opt.value)}
					<!--
						svelte-ignore a11y_click_events_have_key_events -- patrón ARIA
						"Combobox with List Autocomplete": el foco NUNCA llega a este
						`<li>` (se queda en el `<input>`, la opción activa se comunica
						con `aria-activedescendant`), así que no hace falta — ni sería
						correcto — un `onkeydown` propio aquí: Intro/flechas ya están
						completamente cubiertas por el `onkeydown` del input de arriba.
						El `onclick` es solo el atajo de ratón/táctil.
					-->
					<li
						id={optionId(opt.value)}
						role="option"
						aria-selected={opt.value === value}
						aria-disabled={opt.disabled}
						class="gg-combobox__option"
						class:gg-combobox__option--active={opt.value === activeValue}
						class:gg-combobox__option--disabled={opt.disabled}
						onmousedown={(e) => e.preventDefault()}
						onclick={() => selectOption(opt)}
					>
						{opt.label}
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.gg-combobox {
		position: relative;
		width: 100%;
	}

	.gg-combobox__field-wrap {
		box-sizing: border-box;
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-combobox__field-wrap:focus-within {
		border-color: var(--gg-combobox-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-combobox-ring) 30%, transparent);
	}

	.gg-combobox__field-wrap--disabled {
		opacity: 0.5;
	}

	.gg-combobox__field {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
		padding-inline-end: var(--space-6);
	}

	.gg-combobox__field:disabled {
		cursor: not-allowed;
	}

	:global(.gg-combobox__chevron) {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.gg-combobox__listbox {
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

	.gg-combobox__listbox--bottom {
		top: 100%;
		margin-top: var(--space-1);
	}

	.gg-combobox__listbox--top {
		bottom: 100%;
		margin-bottom: var(--space-1);
	}

	.gg-combobox__option {
		box-sizing: border-box;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		cursor: pointer;
	}

	.gg-combobox__option--active {
		background: var(--surface-sunken);
	}

	.gg-combobox__option--disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.gg-combobox__empty {
		padding: var(--space-2) var(--space-3);
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-combobox__field-wrap {
			transition: none;
		}
	}
</style>
