<script lang="ts">
	/**
	 * FormError (§15) — `role="alert"` para que un lector de pantalla
	 * anuncie el error en cuanto aparece (p. ej. tras un intento de envío
	 * fallido), sin que el foco tenga que moverse hasta él.
	 *
	 * Texto en `--text-danger`, no `--status-danger`: un formulario con
	 * `FormError` puede vivir dentro de una `Card`/`Dialog` tan fácilmente
	 * como suelto sobre `--surface` — mismo motivo que llevó a introducir
	 * `--text-danger` para `Button`/`IconButton` `variant="danger"` (ver
	 * docs/TOKENS.md, "post-ampliación 3").
	 */
	import type { Snippet } from "svelte";

	interface Props {
		id?: string;
		class?: string;
		children: Snippet;
	}

	let { id, class: className = "", children }: Props = $props();
</script>

<p {id} role="alert" class="gg-form-error {className}">
	{@render children()}
</p>

<style>
	.gg-form-error {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		color: var(--text-danger);
	}
</style>
