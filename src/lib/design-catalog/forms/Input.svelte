<script lang="ts">
	/**
	 * Input (§12) — UN solo componente para todos los tipos de texto de una
	 * línea (text/email/password/search/tel/url/number), vía la prop
	 * nativa `type` — igual que hace `<input>` de HTML. No hay
	 * TextInput/EmailInput/PasswordInput/... por separado: serían la misma
	 * pieza visual repetida 7 veces, justo lo que §65 pide evitar
	 * ("evitar componentes monolíticos" corta en las dos direcciones — ni
	 * un componente que lo haga todo, ni siete que hacen lo mismo).
	 *
	 * Todo lo que no es tamaño/estado/icono se pasa por `...rest`
	 * (name, required, min/max/step, autocomplete, aria-*, pattern...) en
	 * vez de enumerarlo como prop — evita las "props demasiado
	 * específicas" que pide evitar la misma sección.
	 *
	 * Corrección de Fase 6 (bug de origen en Fase 2, ver docs/ROADMAP.md
	 * y el mismo comentario en `Select.svelte`/`TextArea.svelte`): `style`
	 * llegaba por `...rest` y, al repartirse DESPUÉS de `style={fieldStyle}`
	 * en el `<input>`, un `style` del consumidor borraba el padding/
	 * tipografía calculados en vez de sumarse. Ahora es una prop
	 * explícita, excluida de `...rest`, y se aplica al SPAN envoltorio
	 * (`wrapperStyle`) — es el elemento con `width:100%`, el que de
	 * verdad hace falta poder acotar con un `max-width` desde fuera.
	 */
	import type { HTMLInputAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { ControlSize, ControlState } from "./types.js";
	import { controlSizeSpec, stateBorderVar, stateRingVar } from "./types.js";

	interface Props extends Omit<HTMLInputAttributes, "size" | "value" | "type" | "class" | "style"> {
		type?: "text" | "email" | "password" | "search" | "tel" | "url" | "number";
		value?: string | number;
		size?: ControlSize;
		state?: ControlState;
		leadingIcon?: Snippet;
		trailingIcon?: Snippet;
		class?: string;
		style?: string;
	}

	let {
		type = "text",
		value = $bindable(""),
		size = "md",
		state = "default",
		disabled = false,
		readonly = false,
		leadingIcon,
		trailingIcon,
		class: className = "",
		style: styleProp = "",
		id,
		...rest
	}: Props = $props();

	let sz = $derived(controlSizeSpec(size));
	let wrapperStyle = $derived(
		`border-radius:${sz.radius};` +
			`border-color:${stateBorderVar(state)};` +
			`--gg-input-ring:${stateRingVar(state)};` +
			styleProp
	);
	let fieldStyle = $derived(
		`padding:${sz.paddingY} ${sz.paddingX};` + `font-size:${sz.fontSize};` + `line-height:${sz.lineHeight};`
	);
</script>

<span class="gg-input {className}" class:gg-input--disabled={disabled} style={wrapperStyle}>
	{#if leadingIcon}
		<span class="gg-input__icon" aria-hidden="true">{@render leadingIcon()}</span>
	{/if}
	<input
		{id}
		{type}
		bind:value
		{disabled}
		{readonly}
		aria-invalid={state === "error" ? "true" : undefined}
		class="gg-input__field"
		style={fieldStyle}
		{...rest}
	/>
	{#if trailingIcon}
		<span class="gg-input__icon" aria-hidden="true">{@render trailingIcon()}</span>
	{/if}
</span>

<style>
	.gg-input {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			box-shadow var(--duration-fast) var(--easing-standard);
	}

	.gg-input:focus-within {
		border-color: var(--gg-input-ring);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gg-input-ring) 30%, transparent);
	}

	.gg-input--disabled {
		opacity: 0.5;
	}

	.gg-input__field {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-weight: var(--text-body-weight);
	}

	.gg-input__field::placeholder {
		color: var(--text-muted);
	}

	.gg-input__field:disabled {
		cursor: not-allowed;
	}

	.gg-input__field:read-only {
		cursor: default;
	}

	.gg-input__icon {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--text-muted);
		padding-inline: var(--space-3);
	}

	.gg-input__icon:first-child {
		padding-inline-end: 0;
	}

	.gg-input__icon:last-child {
		padding-inline-start: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-input {
			transition: none;
		}
	}
</style>
