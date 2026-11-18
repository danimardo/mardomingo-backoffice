<script lang="ts">
	/**
	 * FileUpload — zona de arrastrar-y-soltar + botón de examinar,
	 * validación de tipo/tamaño y lista de ficheros con progreso
	 * (candidato #8 de la ronda de ampliación post-v0.13.0, ver
	 * docs/ROADMAP.md).
	 *
	 * Mismo reparto de responsabilidad que `ToastStack`/`FilterBar`: NO
	 * posee el estado de subida — `files` llega ya calculado (el
	 * consumidor sube de verdad los ficheros y actualiza `status`/
	 * `progress`), `FileUpload` solo pinta la lista y emite
	 * `onFilesSelected` con los ficheros NUEVOS que ya pasaron la
	 * validación de tipo/tamaño. Lo que sí resuelve por dentro es esa
	 * validación (tipo vía `accept`, tamaño vía `maxSizeBytes`) — es
	 * trabajo repetitivo e idéntico en cualquier consumidor, a diferencia
	 * de la subida en sí (que depende del backend de cada app).
	 *
	 * La zona de soltar es un `<button>` NATIVO (no un `<div
	 * role="button">` a mano) — los eventos de arrastre de HTML5
	 * (`dragover`/`drop`) funcionan igual sobre un botón, y así Intro/
	 * Espacio abren el selector de fichero gratis, sin reinventar el
	 * manejo de teclado que ya cubrió `IconButton`/`Button` en Fase 1.
	 */
	import { Icon } from "../icons/index.js";

	export interface UploadFile {
		id: string;
		name: string;
		size: number;
		status: "pending" | "uploading" | "done" | "error";
		/** Fracción 0-1, solo relevante en `status: "uploading"`. */
		progress?: number;
		errorMessage?: string;
	}

	interface Props {
		files?: UploadFile[];
		accept?: string;
		multiple?: boolean;
		maxSizeBytes?: number;
		onFilesSelected: (files: File[]) => void;
		onRemove?: (id: string) => void;
		disabled?: boolean;
		label?: string;
		hint?: string;
		class?: string;
	}

	let {
		files = [],
		accept,
		multiple = true,
		maxSizeBytes,
		onFilesSelected,
		onRemove,
		disabled = false,
		label = "Arrastra archivos aquí o haz clic para seleccionar",
		hint,
		class: className = ""
	}: Props = $props();

	let inputEl: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let rejected: { name: string; reason: string }[] = $state([]);

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
		return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	}

	function matchesAccept(file: File, pattern: string): boolean {
		return pattern
			.split(",")
			.map((p) => p.trim())
			.some((p) => {
				if (p === "") return false;
				if (p.startsWith(".")) return file.name.toLowerCase().endsWith(p.toLowerCase());
				if (p.endsWith("/*")) return file.type.startsWith(p.slice(0, -1));
				return file.type === p;
			});
	}

	function validate(list: File[]): { valid: File[]; invalid: { name: string; reason: string }[] } {
		const valid: File[] = [];
		const invalid: { name: string; reason: string }[] = [];
		for (const file of list) {
			if (accept && !matchesAccept(file, accept)) {
				invalid.push({ name: file.name, reason: `tipo no admitido (se espera ${accept})` });
				continue;
			}
			if (maxSizeBytes != null && file.size > maxSizeBytes) {
				invalid.push({ name: file.name, reason: `supera el tamaño máximo (${formatBytes(maxSizeBytes)})` });
				continue;
			}
			valid.push(file);
		}
		return { valid, invalid };
	}

	function handleFiles(list: FileList | null) {
		if (!list || list.length === 0) return;
		const { valid, invalid } = validate(Array.from(list));
		rejected = invalid;
		if (valid.length > 0) onFilesSelected(multiple ? valid : valid.slice(0, 1));
	}

	function onInputChange(e: Event) {
		handleFiles((e.target as HTMLInputElement).files);
		(e.target as HTMLInputElement).value = "";
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (disabled) return;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) dragging = true;
	}

	function onDragLeave() {
		dragging = false;
	}
</script>

<div class="gg-file-upload {className}">
	<button
		type="button"
		class="gg-file-upload__zone"
		class:gg-file-upload__zone--dragging={dragging}
		{disabled}
		onclick={() => inputEl?.click()}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<Icon
			name="upload"
			size="1.5em"
			legacySvg={{
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				body: '<path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke-linecap="round" stroke-linejoin="round" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke-linecap="round" stroke-linejoin="round" />'
			}}
		/>
		<span class="gg-file-upload__label">{label}</span>
		{#if hint}
			<span class="gg-file-upload__hint">{hint}</span>
		{/if}
	</button>
	<input bind:this={inputEl} type="file" class="gg-file-upload__input" {accept} {multiple} {disabled} onchange={onInputChange} tabindex="-1" />

	{#if rejected.length > 0}
		<ul class="gg-file-upload__rejected" role="alert">
			{#each rejected as r, i (`${r.name}-${i}`)}
				<li>«{r.name}»: {r.reason}</li>
			{/each}
		</ul>
	{/if}

	{#if files.length > 0}
		<ul class="gg-file-upload__list">
			{#each files as file (file.id)}
				<li class="gg-file-upload__item">
					<Icon
						name="file"
						class="gg-file-upload__item-icon"
						size="1.1em"
						legacySvg={{
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							body: '<path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-5-6z" stroke-linecap="round" stroke-linejoin="round" /><path d="M14 2v6h5" stroke-linecap="round" stroke-linejoin="round" />'
						}}
					/>
					<div class="gg-file-upload__item-body">
						<div class="gg-file-upload__item-head">
							<span class="gg-file-upload__item-name">{file.name}</span>
							<span class="gg-file-upload__item-size">{formatBytes(file.size)}</span>
						</div>
						{#if file.status === "uploading"}
							<div class="gg-file-upload__item-progress-track" role="progressbar" aria-label={`Subiendo ${file.name}`} aria-valuenow={Math.round((file.progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
								<div class="gg-file-upload__item-progress-fill" style={`width:${Math.round((file.progress ?? 0) * 100)}%;`}></div>
							</div>
						{:else if file.status === "error"}
							<span class="gg-file-upload__item-error">{file.errorMessage ?? "Error al subir"}</span>
						{/if}
					</div>
					{#if file.status === "done"}
						<Icon
							name="check"
							tone="success"
							class="gg-file-upload__item-status gg-file-upload__item-status--done"
							size="1.1em"
							legacySvg={{
								viewBox: "0 0 16 16",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "2",
								body: '<path d="M3 8.5l3.2 3.2L13 4.5" />'
							}}
						/>
					{/if}
					{#if onRemove}
						<button type="button" class="gg-file-upload__item-remove" aria-label={`Quitar «${file.name}»`} onclick={() => onRemove?.(file.id)}>
							<Icon
								name="x"
								size="0.8em"
								legacySvg={{
									viewBox: "0 0 16 16",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.8",
									strokeLinecap: "round",
									body: '<path d="M4 4l8 8M12 4l-8 8" />'
								}}
							/>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.gg-file-upload {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.gg-file-upload__zone {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-6) var(--space-4);
		background: var(--surface-sunken);
		border: 2px dashed var(--border-strong);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing-standard),
			background-color var(--duration-fast) var(--easing-standard);
	}

	.gg-file-upload__zone:hover:not(:disabled) {
		border-color: var(--surface-button-primary);
	}

	.gg-file-upload__zone:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.gg-file-upload__zone--dragging {
		border-color: var(--surface-button-primary);
		background: color-mix(in srgb, var(--interactive-primary) 10%, var(--surface-sunken));
	}

	.gg-file-upload__zone:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.gg-file-upload__label {
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		text-align: center;
	}

	.gg-file-upload__hint {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
		text-align: center;
	}

	.gg-file-upload__input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.gg-file-upload__rejected {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		list-style: none;
		background: color-mix(in srgb, var(--status-danger) 12%, var(--surface));
		border-radius: var(--radius-sm);
		color: var(--text-danger);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-file-upload__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gg-file-upload__item {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	:global(.gg-file-upload__item-icon) {
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.gg-file-upload__item-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.gg-file-upload__item-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.gg-file-upload__item-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
	}

	.gg-file-upload__item-size {
		flex-shrink: 0;
		color: var(--text-muted);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}

	.gg-file-upload__item-progress-track {
		height: var(--space-1);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		overflow: hidden;
	}

	.gg-file-upload__item-progress-fill {
		height: 100%;
		background: var(--interactive-primary);
		transition: width var(--duration-normal) var(--easing-standard);
	}

	.gg-file-upload__item-error {
		color: var(--text-danger);
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
	}

	:global(.gg-file-upload__item-status--done) {
		flex-shrink: 0;
		color: var(--status-success);
	}

	.gg-file-upload__item-remove {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.gg-file-upload__item-remove:hover {
		background: var(--surface-sunken);
		color: var(--text-primary);
	}

	.gg-file-upload__item-remove:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-file-upload__zone,
		.gg-file-upload__item-progress-fill {
			transition: none;
		}
	}
</style>
