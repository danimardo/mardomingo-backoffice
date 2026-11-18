<script lang="ts">
	/**
	 * Spinner (§24) — versión SUELTA del indicador que `DataTable`/
	 * `StructuredList`/`AdaptiveDataView` ya llevaban dibujado a mano
	 * dentro de su propio estado `loading` desde Fase 4. Decisión
	 * deliberada: NO se han refactorizado esas tres piezas para que
	 * reutilicen este componente — ya estaban verificadas (svelte-check,
	 * Playwright, `prefers-reduced-motion`) y tocarlas solo por DRY sin
	 * un fallo real de por medio es el mismo riesgo que ya se evitó al
	 * NO tocar `Button.danger` en Fase 4 (ver `docs/TOKENS.md`). `Loader`/
	 * `ProgressBar`/`CircularProgress`/`LinearProgress`/`ProgressRing`/
	 * `LoadingOverlay` del catálogo completo de §24 quedan fuera — son
	 * indicadores de progreso DETERMINADO (con porcentaje), un patrón
	 * distinto de "en curso, sin cifra" que es lo único que cubre
	 * `Spinner`.
	 *
	 * `role="status"` + `aria-label` en el propio elemento (no un
	 * `<span>` de texto oculto aparte) — un giro visual por sí solo no
	 * comunica nada a quien no lo ve.
	 */
	interface Props {
		size?: "sm" | "md" | "lg";
		/** Anunciado por el lector de pantalla — el giro no comunica nada por sí solo. */
		label?: string;
		class?: string;
	}

	let { size = "md", label = "Cargando", class: className = "" }: Props = $props();
</script>

<span class="gg-spinner gg-spinner--{size} {className}" role="status" aria-label={label}></span>

<style>
	.gg-spinner {
		display: inline-block;
		box-sizing: border-box;
		border-radius: var(--radius-full);
		border: 2px solid var(--border-strong);
		border-top-color: var(--text-muted);
		animation: gg-spinner-spin var(--duration-slow) linear infinite;
	}

	.gg-spinner--sm {
		width: var(--space-4);
		height: var(--space-4);
	}

	.gg-spinner--md {
		width: var(--space-6);
		height: var(--space-6);
	}

	.gg-spinner--lg {
		width: var(--space-8);
		height: var(--space-8);
		border-width: 3px;
	}

	@keyframes gg-spinner-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-spinner {
			animation: none;
		}
	}
</style>
