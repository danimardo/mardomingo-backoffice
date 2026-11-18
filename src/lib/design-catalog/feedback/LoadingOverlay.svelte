<script lang="ts">
	/**
	 * LoadingOverlay (ampliación 3, §24 — dejado fuera junto con
	 * `ProgressBar`/`CircularProgress` en Fase 5, ya construidos en las
	 * ampliaciones 1/2; ver la nota de cabecera de `Spinner.svelte`) —
	 * fondo atenuado + `Spinner` centrado sobre un ÁREA DE CONTENIDO (una
	 * `Card`, un panel, una sección de formulario), NO la página entera.
	 * `Dialog`/`Modal` (Fase 5) ya cubren el caso "página entera" con su
	 * propio backdrop `position:fixed`; esto es su equivalente LOCAL — el
	 * mismo patrón visual de atenuación (`color-mix(in srgb,
	 * var(--color-black) 60%, transparent)`, igual que
	 * `.gg-dialog-backdrop`) pero `position:absolute` dentro de un
	 * contenedor con `position:relative` propio, en vez de `fixed` sobre
	 * el viewport.
	 *
	 * NO reimplementa el giro — compone `Spinner` (Fase 5) tal cual,
	 * mismo criterio que `ActionCard` reutilizó `hoverLift` en vez de
	 * escribir su propia transición. `aria-busy` en el contenedor (no
	 * solo en el `Spinner`) para que un lector de pantalla sepa que ESA
	 * región entera está ocupada, no solo que hay un giro decorativo en
	 * algún punto de ella — `Spinner` ya aporta su propio
	 * `role="status"`/`aria-label`, aquí no se duplica.
	 *
	 * El contenido cubierto NO se desmonta (a diferencia de
	 * `DetailPage`, Fase 6, que sí sustituye su contenido por un
	 * `Spinner` mientras carga) — aquí el consumidor puede querer seguir
	 * viendo el dato ANTERIOR atenuado debajo mientras llega el nuevo
	 * (p. ej. refrescar una tabla sin que desaparezca de golpe). Por eso
	 * es un componente con `children`, no una condición `{#if loading}`
	 * que el propio consumidor ya podría escribir a mano.
	 */
	import type { Snippet } from "svelte";
	import Spinner from "./Spinner.svelte";

	interface Props {
		loading: boolean;
		/** Anunciado por `Spinner` — el giro no comunica nada por sí solo. */
		label?: string;
		size?: "sm" | "md" | "lg";
		class?: string;
		children: Snippet;
	}

	let { loading, label = "Cargando", size = "md", class: className = "", children }: Props = $props();
</script>

<div class="gg-loading-overlay {className}" aria-busy={loading}>
	{@render children()}
	{#if loading}
		<div class="gg-loading-overlay__scrim" role="presentation">
			<Spinner {size} {label} />
		</div>
	{/if}
</div>

<style>
	.gg-loading-overlay {
		position: relative;
	}

	.gg-loading-overlay__scrim {
		position: absolute;
		inset: 0;
		z-index: var(--z-overlay-local);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--overlay-backdrop);
		border-radius: inherit;
	}
</style>
