<script lang="ts">
	// Documentos legales pendientes de aceptar en el panel (W18; BE-FR-70; T279). Cada documento lleva su enlace para leerlo
	// antes de aceptar, con la versión que se acepta, y las casillas nacen sin marcar (BE-FR-70 CA2). Funciona sin JavaScript:
	// es un formulario POST a la acción `?/aceptarDocumentos` de la página que lo contiene.
	import * as m from '$lib/paraglide/messages.js';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface Item {
		readonly document: string;
		readonly version: string;
		readonly label: string;
		/** Ruta ya resuelta del documento, o `null` si no tiene página propia. */
		readonly url: string | null;
	}

	interface Props {
		items: readonly Item[];
		/** `true` si el último envío no pudo registrarse (versión cambiada o sin selección). */
		failed: boolean;
	}

	let { items, failed }: Props = $props();
</script>

{#if items.length > 0}
	<section aria-labelledby="pendientes-titulo">
		<h2 id="pendientes-titulo">{m.panel_pending_documents()}</h2>
		<p>{m.panel_pending_effect()}</p>
		{#if failed}
			<Banner level="critical">{m.panel_pending_error()}</Banner>
		{/if}
		<form method="POST" action="?/aceptarDocumentos">
			<fieldset>
				<legend>{m.panel_pending_choose()}</legend>
				{#each items as item (item.document)}
					<div class="casilla">
						<label>
							<input type="checkbox" name="documents" value={`${item.document}:${item.version}`} />
							<span>{m.panel_pending_item({ label: item.label, version: item.version })}</span>
						</label>
						{#if item.url !== null}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- la ruta llega ya resuelta desde el servidor -->
							<a href={item.url} target="_blank" rel="noopener"
								>{m.legal_register_new_tab({
									label: m.panel_pending_read({ label: item.label })
								})}</a
							>
						{/if}
					</div>
				{/each}
			</fieldset>
			<p><Button type="submit" variant="primary">{m.panel_pending_accept()}</Button></p>
		</form>
	</section>
{/if}

<style>
	.casilla {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		min-height: 44px;
	}

	.casilla label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
	}

	.casilla a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
</style>
