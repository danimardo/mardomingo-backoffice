<script lang="ts">
	/**
	 * FormField (§15) — la pieza que de verdad pide la Fase 2: junta
	 * label + control + descripción + error, sin decidir QUÉ control va
	 * dentro. El control se pasa como snippet, y FormField le entrega
	 * `{ id, describedBy, invalid }` para que Input/Select/TextArea/
	 * Checkbox/Radio/Switch queden correctamente asociados sin que el
	 * consumidor tenga que inventar ids a mano ni coordinar
	 * aria-describedby/aria-invalid — API por composición, tal como pide
	 * §65 ("composición; slots/snippets"), no un campo monolítico que
	 * hardcodee un `<input>` por dentro.
	 *
	 * `$props.id()` genera un id único y estable (igual en servidor y
	 * cliente) por instancia del componente — así dos `<FormField>` en la
	 * misma página nunca chocan de id aunque el consumidor no pase
	 * ninguno.
	 */
	import type { Snippet } from "svelte";
	import FormLabel from "./FormLabel.svelte";
	import FormDescription from "./FormDescription.svelte";
	import FormError from "./FormError.svelte";

	export interface FormFieldSlotProps {
		id: string;
		describedBy: string | undefined;
		invalid: boolean;
	}

	interface Props {
		label: string;
		description?: string | undefined;
		error?: string | undefined;
		required?: boolean | undefined;
		class?: string;
		children: Snippet<[FormFieldSlotProps]>;
	}

	let { label, description, error, required = false, class: className = "", children }: Props = $props();

	const uid = $props.id();
	const controlId = `${uid}-control`;
	const descId = `${uid}-desc`;
	const errId = `${uid}-err`;

	let describedBy = $derived([description ? descId : null, error ? errId : null].filter(Boolean).join(" ") || undefined);
</script>

<div class="gg-form-field {className}">
	<FormLabel for={controlId} {required}>{label}</FormLabel>
	<div class="gg-form-field__control">
		{@render children({ id: controlId, describedBy, invalid: !!error })}
	</div>
	{#if description}
		<FormDescription id={descId}>{description}</FormDescription>
	{/if}
	{#if error}
		<FormError id={errId}>{error}</FormError>
	{/if}
</div>

<style>
	.gg-form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.gg-form-field__control {
		margin-top: var(--space-1);
	}
</style>
