<script lang="ts">
	/**
	 * ImageCropper (v1.6.0) — recorte cuadrado de una imagen en el navegador, para fotos de perfil. La imagen se mueve
	 * dentro de un marco cuadrado y se acerca o aleja; el resultado es un `Blob` cuadrado de como mucho `outputSize`
	 * px de lado (nunca se agranda una imagen pequeña).
	 *
	 * - Ratón y táctil: arrastrar mueve; la rueda acerca y aleja.
	 * - Teclado (con el foco en el marco): flechas mueven, `+` y `-` acercan y alejan, `0` vuelve al encuadre inicial.
	 * - Botones visibles para todo lo anterior: ningún gesto es la única forma de hacerlo (WCAG 2.5.1, 2.5.7).
	 * - `onCrop` recibe el recorte al pulsar «Usar este recorte». Sin JavaScript no hay recorte: el consumidor debe
	 *   decirlo en su pantalla.
	 */
	import ArrowDown from "../icons/arrow-down.svelte";
	import ArrowLeft from "../icons/arrow-left.svelte";
	import ArrowRight from "../icons/arrow-right.svelte";
	import ArrowUp from "../icons/arrow-up.svelte";
	import Crosshair from "../icons/crosshair.svelte";
	import ZoomIn from "../icons/zoom-in.svelte";
	import ZoomOut from "../icons/zoom-out.svelte";
	import Button from "../buttons/Button.svelte";
	import IconButton from "../buttons/IconButton.svelte";

	interface Props {
		/** URL de la imagen (p. ej. `URL.createObjectURL(file)`). */
		src: string;
		/** Nombre accesible del marco. */
		label: string;
		/** Lado máximo del recorte en px. */
		outputSize?: number;
		/** Tipo del recorte. */
		type?: "image/jpeg" | "image/webp" | "image/png";
		/** Calidad para JPEG y WebP (0-1). */
		quality?: number;
		/** Texto del botón que entrega el recorte. */
		applyLabel?: string;
		onCrop: (blob: Blob) => void;
		class?: string;
	}

	let {
		src,
		label,
		outputSize = 512,
		type = "image/jpeg",
		quality = 0.85,
		applyLabel = "Usar este recorte",
		onCrop,
		class: className = ""
	}: Props = $props();

	const uid = $props.id();
	const MIN_ZOOM = 1;
	const MAX_ZOOM = 4;
	const ZOOM_STEP = 0.2;
	const MOVE_STEP = 10;

	let frame = $state<HTMLDivElement | undefined>();
	let image = $state<HTMLImageElement | undefined>();
	let natural = $state({ width: 0, height: 0 });
	let frameSize = $state(0);
	let zoom = $state(1);
	let offset = $state({ x: 0, y: 0 });
	let dragging: { pointerId: number; x: number; y: number } | undefined;
	let busy = $state(false);

	/** Escala que cubre el marco con la imagen entera (encuadre inicial). */
	const baseScale = $derived(
		natural.width === 0 || frameSize === 0 ? 1 : Math.max(frameSize / natural.width, frameSize / natural.height)
	);
	const scale = $derived(baseScale * zoom);
	const shown = $derived({ width: natural.width * scale, height: natural.height * scale });

	function clamp(next: { x: number; y: number }): { x: number; y: number } {
		const minX = Math.min(0, frameSize - shown.width);
		const minY = Math.min(0, frameSize - shown.height);
		return { x: Math.min(0, Math.max(minX, next.x)), y: Math.min(0, Math.max(minY, next.y)) };
	}

	function center(): void {
		zoom = 1;
		offset = clamp({ x: (frameSize - natural.width * baseScale) / 2, y: (frameSize - natural.height * baseScale) / 2 });
	}

	function onLoad(): void {
		if (image === undefined) return;
		natural = { width: image.naturalWidth, height: image.naturalHeight };
		frameSize = frame?.clientWidth ?? 0;
		center();
	}

	function setZoom(next: number): void {
		const bounded = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
		// Acercar respecto al centro del marco.
		const focus = frameSize / 2;
		const ratio = bounded / zoom;
		zoom = bounded;
		offset = clamp({ x: focus - (focus - offset.x) * ratio, y: focus - (focus - offset.y) * ratio });
	}

	function move(dx: number, dy: number): void {
		offset = clamp({ x: offset.x + dx, y: offset.y + dy });
	}

	function onPointerDown(event: PointerEvent): void {
		dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
		(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent): void {
		if (dragging === undefined || dragging.pointerId !== event.pointerId) return;
		move(event.clientX - dragging.x, event.clientY - dragging.y);
		dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: PointerEvent): void {
		if (dragging?.pointerId === event.pointerId) dragging = undefined;
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		setZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
	}

	function onKeydown(event: KeyboardEvent): void {
		const actions: Record<string, () => void> = {
			ArrowLeft: () => move(MOVE_STEP, 0),
			ArrowRight: () => move(-MOVE_STEP, 0),
			ArrowUp: () => move(0, MOVE_STEP),
			ArrowDown: () => move(0, -MOVE_STEP),
			"+": () => setZoom(zoom + ZOOM_STEP),
			"=": () => setZoom(zoom + ZOOM_STEP),
			"-": () => setZoom(zoom - ZOOM_STEP),
			"0": center
		};
		const action = actions[event.key];
		if (action === undefined) return;
		event.preventDefault();
		action();
	}

	/** Recorte del marco a un lienzo cuadrado; nunca agranda la imagen original. */
	async function apply(): Promise<void> {
		if (image === undefined || frameSize === 0) return;
		busy = true;
		try {
			const sourceSide = frameSize / scale;
			const side = Math.max(1, Math.min(outputSize, Math.round(sourceSide)));
			const canvas = document.createElement("canvas");
			canvas.width = side;
			canvas.height = side;
			const context = canvas.getContext("2d");
			if (context === null) return;
			context.drawImage(image, -offset.x / scale, -offset.y / scale, sourceSide, sourceSide, 0, 0, side, side);
			const blob = await new Promise<Blob | null>((resolve) => {
				canvas.toBlob(resolve, type, quality);
			});
			if (blob !== null) onCrop(blob);
		} finally {
			busy = false;
		}
	}
</script>

<div class="gg-image-cropper {className}">
	<div bind:this={frame} class="gg-image-cropper__frame">
		<img
			bind:this={image}
			{src}
			alt=""
			draggable="false"
			onload={onLoad}
			class="gg-image-cropper__image"
			style:width="{shown.width}px"
			style:height="{shown.height}px"
			style:transform="translate({offset.x}px, {offset.y}px)"
		/>
		<!-- El control es un botón que cubre el marco: recibe el foco, el teclado y el arrastre. -->
		<button
			type="button"
			class="gg-image-cropper__handle"
			aria-label={label}
			aria-roledescription="recortador de imagen"
			aria-describedby="{uid}-help"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onwheel={onWheel}
			onkeydown={onKeydown}
		></button>
	</div>
	<p id="{uid}-help" class="gg-image-cropper__help">
		Arrastra la imagen o usa las flechas para encuadrarla; + y − para acercar o alejar.
	</p>
	<!-- v1.8.1: botones solo con icono; el nombre accesible y el tooltip nativo (`title`) siguen siendo el texto de siempre. -->
	<div class="gg-image-cropper__controls" role="group" aria-label="Encuadre de la imagen">
		<IconButton label="Acercar" variant="secondary" onclick={() => setZoom(zoom + ZOOM_STEP)}>
			{#snippet icon()}<ZoomIn size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Alejar" variant="secondary" onclick={() => setZoom(zoom - ZOOM_STEP)}>
			{#snippet icon()}<ZoomOut size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Izquierda" onclick={() => move(MOVE_STEP, 0)}>
			{#snippet icon()}<ArrowLeft size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Derecha" onclick={() => move(-MOVE_STEP, 0)}>
			{#snippet icon()}<ArrowRight size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Arriba" onclick={() => move(0, MOVE_STEP)}>
			{#snippet icon()}<ArrowUp size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Abajo" onclick={() => move(0, -MOVE_STEP)}>
			{#snippet icon()}<ArrowDown size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
		<IconButton label="Centrar" onclick={center}>
			{#snippet icon()}<Crosshair size="1.2em" aria-hidden="true" />{/snippet}
		</IconButton>
	</div>
	<Button variant="primary" type="button" loading={busy} onclick={() => void apply()}>{applyLabel}</Button>
</div>

<style>
	.gg-image-cropper {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.gg-image-cropper__frame {
		position: relative;
		overflow: hidden;
		width: var(--space-64);
		max-width: 100%;
		aspect-ratio: 1;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.gg-image-cropper__handle {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: grab;
		touch-action: none;
	}

	.gg-image-cropper__handle:focus-visible {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: calc(var(--focus-offset) * -1);
	}

	.gg-image-cropper__image {
		position: absolute;
		top: 0;
		left: 0;
		max-width: none;
		user-select: none;
		pointer-events: none;
	}

	.gg-image-cropper__help {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-image-cropper__controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
</style>
