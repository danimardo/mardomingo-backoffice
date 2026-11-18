<script lang="ts">
	/**
	 * SubtitleStrip (v1.12.0) — franja de subtítulos en directo con texto original y traducción, legible sobre
	 * cualquier fondo (va en una ventana transparente). Pila centrada de líneas, de abajo arriba: la traducción
	 * encima del original (60 % del tamaño, `--text-secondary`), con etiqueta de idioma o de hablante. Cada línea
	 * lleva su propio fondo pegado al texto (`box-decoration-break: clone`) en `--neutral-950`; las palabras
	 * parciales, en `--neutral-400`. Se pinta SIEMPRE en un ámbito oscuro (`data-theme="dark"`), para que los
	 * tokens se resuelvan en oscuro también con el tema claro.
	 *
	 * Accesibilidad: `role="log"` + `aria-live="polite"`: solo se anuncian los segmentos `final`. `lang` en cada
	 * línea. En `mode="edit"` hay contorno discontinuo, 8 tiradores y una barra (`toolbar`).
	 */
	import type { Component, Snippet } from "svelte";

	export interface SubtitleSegment {
		speaker: "me" | "remote";
		lang?: string;
		original?: string;
		translation?: string;
		final: boolean;
	}

	interface Props {
		segments?: SubtitleSegment[];
		notice?: { tone: "warning" | "info"; icon: Component<{ size?: string | number; "aria-hidden"?: "true" }>; text: string } | null;
		placeholder?: string;
		/** 16-40 px lógicos. */
		fontSize?: number;
		maxLines?: { original: number; translation: number };
		showOriginal?: boolean;
		show?: "remote" | "me" | "both";
		background?: "lines" | "block";
		mode?: "fixed" | "edit";
		langLabel?: (code: string) => string;
		speakerLabels?: { me: string; remote: string };
		toolbar?: Snippet;
		class?: string;
	}

	let {
		segments = [],
		notice = null,
		placeholder = "Esperando a que alguien hable…",
		fontSize = $bindable(26),
		maxLines = { original: 2, translation: 2 },
		showOriginal = true,
		show = "remote",
		background = "lines",
		mode = $bindable("fixed"),
		langLabel = (c: string) => c.toUpperCase(),
		speakerLabels = { me: "YO", remote: "REMOTO" },
		toolbar,
		class: className = "",
		...rest
	}: Props = $props();

	let visible = $derived(segments.filter((s) => show === "both" || s.speaker === show));
	// Las últimas `translation` líneas de traducción y `original` de original, en orden cronológico.
	let lines = $derived.by(() => {
		const tr = visible.filter((s) => s.translation).slice(-maxLines.translation);
		const og = showOriginal ? visible.filter((s) => s.original).slice(-maxLines.original) : [];
		return { tr, og };
	});
	let announceText = $derived(visible.filter((s) => s.final && s.translation).slice(-1)[0]?.translation ?? "");
	let empty = $derived(lines.tr.length === 0 && lines.og.length === 0);
	let clampedSize = $derived(Math.min(40, Math.max(16, fontSize)));
	const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
</script>

<div
	class="gg-subtitles gg-subtitles--{background} {className}"
	class:gg-subtitles--edit={mode === "edit"}
	data-theme="dark"
	style:--gg-sub-size="{clampedSize}px"
	{...rest}
>
	<div class="gg-subtitles__log" role="log" aria-live="polite" aria-atomic="false">
		{#if notice}
			{@const NoticeIcon = notice.icon}
			<p class="gg-subtitles__notice gg-subtitles__notice--{notice.tone}"><NoticeIcon size="1em" aria-hidden="true" /><span>{notice.text}</span></p>
		{/if}
		{#if empty && !notice}
			<p class="gg-subtitles__line gg-subtitles__line--placeholder">{placeholder}</p>
		{/if}
		{#each lines.og as s, i (i)}
			<p class="gg-subtitles__line gg-subtitles__line--original" lang={s.lang}>
				<span class="gg-subtitles__tag gg-subtitles__tag--lang">{s.lang ? langLabel(s.lang) : speakerLabels[s.speaker]}</span>
				<span class:gg-subtitles__partial={!s.final}>{s.original}</span>
			</p>
		{/each}
		{#each lines.tr as s, i (i)}
			<p class="gg-subtitles__line gg-subtitles__line--translation" lang={s.lang}>
				{#if show === "both"}<span class="gg-subtitles__tag" class:gg-subtitles__tag--me={s.speaker === "me"}>{speakerLabels[s.speaker]}</span>{/if}
				<span class:gg-subtitles__partial={!s.final}>{s.translation}</span>
			</p>
		{/each}
	</div>
	<span class="gg-subtitles__announce" aria-live="polite">{announceText}</span>
	{#if mode === "edit"}
		{#each HANDLES as h (h)}<span class="gg-subtitles__handle gg-subtitles__handle--{h}" role="slider" tabindex="0" aria-label="Tirador {h.toUpperCase()}" aria-valuenow={0}></span>{/each}
		{#if toolbar}<div class="gg-subtitles__toolbar" role="toolbar" aria-label="Edición de subtítulos">{@render toolbar()}</div>{/if}
	{/if}
</div>

<style>
	.gg-subtitles {
		position: relative;
		box-sizing: border-box;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 100%;
		min-height: var(--space-16);
		padding: var(--space-2);
		font-family: var(--font-sans);
		--gg-sub-bg: color-mix(in srgb, var(--neutral-950) 86%, transparent);
		--gg-sub-bg-original: color-mix(in srgb, var(--neutral-950) 74%, transparent);
	}

	.gg-subtitles--block {
		--gg-sub-bg: var(--neutral-950);
		--gg-sub-bg-original: var(--neutral-950);
	}

	.gg-subtitles--edit {
		outline: 2px dashed var(--interactive-primary);
		outline-offset: -2px;
	}

	.gg-subtitles__log {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		max-width: 100%;
		text-align: center;
	}

	.gg-subtitles__line {
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		background: var(--gg-sub-bg);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
		color: var(--text-primary);
		font-size: var(--gg-sub-size);
		font-weight: 500;
		line-height: 1.3;
	}

	.gg-subtitles__line--original {
		background: var(--gg-sub-bg-original);
		color: var(--text-secondary);
		font-size: calc(var(--gg-sub-size) * 0.6);
		font-weight: 400;
		order: 2;
	}

	.gg-subtitles__line--translation {
		order: 1;
	}

	.gg-subtitles__line--placeholder {
		color: var(--text-secondary);
		font-size: calc(var(--gg-sub-size) * 0.7);
	}

	.gg-subtitles__partial {
		color: var(--neutral-400);
	}

	.gg-subtitles__tag {
		margin-inline-end: var(--space-2);
		color: var(--text-secondary);
		font-size: 0.55em;
		font-weight: var(--text-label-weight);
		letter-spacing: 0.06em;
	}

	.gg-subtitles__tag--lang {
		color: var(--primary-300);
	}

	.gg-subtitles__tag--me {
		color: var(--accent-300);
	}

	.gg-subtitles__notice {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--warning-300) 20%, var(--neutral-950));
		color: var(--warning-300);
		font-size: calc(var(--gg-sub-size) * 0.65);
		font-weight: var(--text-label-weight);
	}

	.gg-subtitles__notice--info {
		background: color-mix(in srgb, var(--primary-300) 20%, var(--neutral-950));
		color: var(--primary-300);
	}

	.gg-subtitles__announce {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.gg-subtitles__handle {
		position: absolute;
		width: var(--space-2);
		height: var(--space-2);
		border: 2px solid var(--interactive-primary);
		border-radius: var(--radius-xs);
		background: var(--neutral-950);
	}

	.gg-subtitles__handle--nw { top: 0; left: 0; }
	.gg-subtitles__handle--n { top: 0; left: 50%; }
	.gg-subtitles__handle--ne { top: 0; right: 0; }
	.gg-subtitles__handle--e { top: 50%; right: 0; }
	.gg-subtitles__handle--se { bottom: 0; right: 0; }
	.gg-subtitles__handle--s { bottom: 0; left: 50%; }
	.gg-subtitles__handle--sw { bottom: 0; left: 0; }
	.gg-subtitles__handle--w { top: 50%; left: 0; }

	.gg-subtitles__toolbar {
		position: absolute;
		top: calc(var(--space-10) * -1);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--shadow-floating);
	}
</style>
