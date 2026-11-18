
<script lang="ts">
	/**
	 * UpdatePrompt (§60.9, "Update UI" en §69) — tarjeta con los tres
	 * momentos de una actualización: disponible (con notas de versión),
	 * descargando (barra de progreso) y lista para reiniciar. Del
	 * catálogo de 60.9 (`UpdateAvailableDialog`/`UpdateProgress`/
	 * `UpdateRestartPrompt`/`UpdateStatus`) se exporta UNA sola pieza que
	 * cambia de contenido según `state` — mismo criterio que
	 * `DetailPage` (Fase 6) cambiando de contenido según `loading`, en
	 * vez de 4 componentes separados que el consumidor tendría que
	 * alternar él mismo.
	 *
	 * Puramente presentacional — no importa `@tauri-apps/*` (ver
	 * `tauriEnv.ts`). El consumidor llama a `checkForUpdate()`/
	 * `downloadAndInstallUpdate()` de `updateBridge.ts`, y pasa el
	 * resultado como props: `state="available"` + `version`/`body` tras
	 * `checkForUpdate()`, `state="downloading"` + `progress` durante
	 * `downloadAndInstallUpdate(info, onProgress)`, `state="ready"`
	 * cuando esa promesa resuelve en plataformas donde no se reinicia
	 * sola (macOS/Linux — Windows termina la app por su cuenta, ver la
	 * documentación de la propia API en `updateBridge.ts`).
	 *
	 * `progress` es `number | null` (fracción 0-1, o indeterminado) —
	 * `null` reutiliza el propio `Spinner` (Fase 5, indicador "en curso,
	 * sin cifra"); un valor numérico pinta una barra de progreso
	 * DETERMINADA hecha a mano AQUÍ, sin exportarla como pieza aparte:
	 * `Spinner.svelte` ya documentó en Fase 5 que `ProgressBar`/
	 * `LinearProgress` (§24) quedaban fuera del catálogo curado por ser
	 * un patrón distinto (con cifra) — esta barra es un detalle interno
	 * de `UpdatePrompt`, no una nueva pieza exportada, así que no
	 * contradice esa decisión de alcance. Respeta
	 * `prefers-reduced-motion` igual que el resto del paquete.
	 */
	import Button from "../buttons/Button.svelte";
	import Spinner from "../feedback/Spinner.svelte";
	import Download from "../icons/download.svelte";

	/**
	 * v1.12.0: `"required"` — actualización OBLIGATORIA (versión inferior a la mínima): sin «Más tarde» ni
	 * `onDismiss`, borde `--status-warning` con icono de descarga, y el `body` explica por qué no se puede seguir.
	 * Se usa dentro de un `Dialog` con `closeOnBackdropClick={false}` y `closeOnEscape={false}`.
	 */
	type UpdatePromptState = "available" | "required" | "downloading" | "ready";

	interface Props {
		state: UpdatePromptState;
		version: string;
		currentVersion?: string | undefined;
		body?: string | undefined;
		/** Fracción 0-1 descargada, o `null` si el progreso es indeterminado. Solo se usa en `state="downloading"`. */
		progress?: number | null | undefined;
		installLabel?: string | undefined;
		laterLabel?: string | undefined;
		restartLabel?: string | undefined;
		/** Texto del botón en `state="required"`. */
		requiredLabel?: string | undefined;
		onInstall?: (() => void) | undefined;
		onDismiss?: (() => void) | undefined;
		onRestart?: (() => void) | undefined;
		class?: string | undefined;
	}

	let {
		state,
		version,
		currentVersion,
		body,
		progress = null,
		installLabel = "Instalar y reiniciar",
		laterLabel = "Más tarde",
		restartLabel = "Reiniciar ahora",
		requiredLabel = "Actualizar ahora",
		onInstall,
		onDismiss,
		onRestart,
		class: className = ""
	}: Props = $props();

	let progressPercent = $derived(progress === null ? null : Math.round(progress * 100));
</script>

<div class="gg-update-prompt {className}" class:gg-update-prompt--required={state === "required"} role="status">
	<div class="gg-update-prompt__header">
		<span class="gg-update-prompt__title">
			{#if state === "required"}
				<span class="gg-update-prompt__req-icon" aria-hidden="true"><Download size="1em" aria-hidden="true" /></span>
				Actualización obligatoria: versión {version}
			{:else if state === "ready"}
				Actualización lista
			{:else}
				Versión {version} disponible
			{/if}
		</span>
		{#if currentVersion && state !== "ready"}
			<span class="gg-update-prompt__current">Actual: {currentVersion}</span>
		{/if}
	</div>

	{#if state === "available"}
		{#if body}
			<p class="gg-update-prompt__body">{body}</p>
		{/if}
		<div class="gg-update-prompt__actions">
			<Button variant="secondary" size="sm" onclick={onDismiss}>{laterLabel}</Button>
			<Button variant="primary" size="sm" onclick={onInstall}>{installLabel}</Button>
		</div>
	{:else if state === "required"}
		{#if body}
			<p class="gg-update-prompt__body">{body}</p>
		{/if}
		<div class="gg-update-prompt__actions">
			<Button variant="primary" size="sm" onclick={onInstall}>{requiredLabel}</Button>
		</div>
	{:else if state === "downloading"}
		<div class="gg-update-prompt__progress-row">
			{#if progressPercent === null}
				<Spinner size="sm" label="Descargando actualización" />
				<span>Descargando…</span>
			{:else}
				<div class="gg-update-prompt__track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Descargando actualización">
					<div class="gg-update-prompt__fill" style={`width:${progressPercent}%;`}></div>
				</div>
				<span class="gg-update-prompt__percent">{progressPercent}%</span>
			{/if}
		</div>
	{:else}
		<p class="gg-update-prompt__body">La versión {version} se instalará al reiniciar.</p>
		<div class="gg-update-prompt__actions">
			<Button variant="primary" size="sm" onclick={onRestart}>{restartLabel}</Button>
		</div>
	{/if}
</div>

<style>
	.gg-update-prompt {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		max-width: var(--overlay-width-sm);
		padding: var(--space-4);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-raised);
		font-family: var(--font-sans);
	}

	.gg-update-prompt--required {
		border-color: var(--status-warning);
	}

	.gg-update-prompt__req-icon {
		display: inline-flex;
		margin-inline-end: var(--space-2);
		color: var(--status-warning);
		vertical-align: middle;
	}

	.gg-update-prompt__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.gg-update-prompt__title {
		color: var(--text-primary);
		font-weight: var(--text-label-weight);
		font-size: var(--text-body-size);
	}

	.gg-update-prompt__current {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}

	.gg-update-prompt__body {
		margin: 0;
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-update-prompt__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.gg-update-prompt__progress-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--text-secondary);
		font-size: var(--text-body-sm-size);
	}

	.gg-update-prompt__track {
		flex: 1;
		height: var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		overflow: hidden;
	}

	.gg-update-prompt__fill {
		height: 100%;
		background: var(--status-info);
		border-radius: var(--radius-full);
		transition: width var(--duration-normal) var(--easing-standard);
	}

	.gg-update-prompt__percent {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-update-prompt__fill {
			transition: none;
		}
	}
</style>
