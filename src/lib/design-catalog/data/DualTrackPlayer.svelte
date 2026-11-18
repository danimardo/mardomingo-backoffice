<script lang="ts">
	/**
	 * DualTrackPlayer (v1.12.0) — reproductor de una o varias pistas de audio relacionadas, con forma de onda y
	 * posición. Una fila por pista: botón redondo play/pausa, nombre, onda (barras; las reproducidas en
	 * `--interactive-primary`, el resto en `--border-strong`) y tiempo. Con `sync` las pistas comparten posición
	 * (reproducir una pausa la otra); sin él, son independientes. Cada onda es un `role="slider"` de la posición
	 * (flechas ±5 s, `aria-valuetext` «12:04 de 51:00»); Espacio reproduce o pausa la pista enfocada.
	 * Estados: parado, reproduciendo, `loading` (Skeleton sobre la onda) y pista ilegible (`error` en el track).
	 */
	import type { Snippet } from "svelte";
	import Play from "../icons/play.svelte";
	import Pause from "../icons/pause.svelte";
	import TriangleAlert from "../icons/triangle-alert.svelte";
	import { IconButton } from "../buttons/index.js";
	import Skeleton from "../feedback/Skeleton.svelte";

	export interface PlayerTrack {
		id: string;
		label: string;
		src: string;
		/** Picos normalizados 0-1 para dibujar la onda. */
		peaks?: number[];
		/** Duración conocida (s) si el audio aún no ha cargado metadatos. */
		duration?: number;
		/** La pista no se puede leer. */
		error?: string;
	}

	interface Props {
		tracks: PlayerTrack[];
		/** Id de la pista que suena (`null` = parado). */
		current?: string | null;
		/** Posición en segundos (compartida si `sync`). */
		position?: number;
		sync?: boolean;
		playLabel?: (label: string) => string;
		pauseLabel?: (label: string) => string;
		loading?: boolean;
		footer?: Snippet;
		class?: string;
	}

	let { tracks, current = $bindable(null), position = $bindable(0), sync = true, playLabel = (l: string) => `Reproducir ${l}`, pauseLabel = (l: string) => `Pausar ${l}`, loading = false, footer, class: className = "", ...rest }: Props = $props();

	let audios: Record<string, HTMLAudioElement | undefined> = $state({});
	let durations: Record<string, number> = $state({});
	let positions: Record<string, number> = $state({});

	const BARS = 64;
	function peaksOf(t: PlayerTrack): number[] {
		const src = t.peaks && t.peaks.length ? t.peaks : Array.from({ length: BARS }, (_, i) => 0.3 + 0.25 * Math.sin(i * 0.7));
		return Array.from({ length: BARS }, (_, i) => src[Math.min(src.length - 1, Math.floor((i / BARS) * src.length))] ?? 0);
	}
	function dur(t: PlayerTrack): number {
		return durations[t.id] ?? t.duration ?? 0;
	}
	function pos(t: PlayerTrack): number {
		return sync ? position : (positions[t.id] ?? 0);
	}
	function fmt(s: number): string {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	}

	function seek(t: PlayerTrack, to: number) {
		const d = dur(t);
		const v = Math.min(d || to, Math.max(0, to));
		if (sync) {
			position = v;
			for (const a of Object.values(audios)) if (a) a.currentTime = v;
		} else {
			positions[t.id] = v;
			const a = audios[t.id];
			if (a) a.currentTime = v;
		}
	}

	function toggle(t: PlayerTrack) {
		const a = audios[t.id];
		if (!a || t.error) return;
		if (current === t.id) {
			a.pause();
			current = null;
			return;
		}
		if (sync) for (const [id, other] of Object.entries(audios)) if (id !== t.id) other?.pause();
		a.currentTime = pos(t);
		void a.play().catch(() => {});
		current = t.id;
	}

	function onWaveKey(e: KeyboardEvent, t: PlayerTrack) {
		if (e.key === "ArrowRight") seek(t, pos(t) + 5);
		else if (e.key === "ArrowLeft") seek(t, pos(t) - 5);
		else if (e.key === "Home") seek(t, 0);
		else if (e.key === "End") seek(t, dur(t));
		else if (e.key === " ") toggle(t);
		else return;
		e.preventDefault();
	}

	function onWaveClick(e: MouseEvent, t: PlayerTrack) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		seek(t, ((e.clientX - r.left) / r.width) * dur(t));
	}
</script>

<div class="gg-player {className}" {...rest}>
	{#each tracks as t (t.id)}
		{@const playing = current === t.id}
		{@const p = peaksOf(t)}
		{@const frac = dur(t) > 0 ? pos(t) / dur(t) : 0}
		<div class="gg-player__track" class:gg-player__track--playing={playing}>
			<audio
				bind:this={audios[t.id]}
				src={t.src}
				preload="metadata"
				onloadedmetadata={(e) => (durations[t.id] = e.currentTarget.duration)}
				ontimeupdate={(e) => (sync ? (position = e.currentTarget.currentTime) : (positions[t.id] = e.currentTarget.currentTime))}
				onended={() => (current = null)}
			></audio>
			<IconButton label={playing ? pauseLabel(t.label) : playLabel(t.label)} variant="secondary" size="sm" disabled={Boolean(t.error) || loading} onclick={() => toggle(t)}>
				{#snippet icon()}{#if playing}<Pause size="1em" aria-hidden="true" />{:else}<Play size="1em" aria-hidden="true" />{/if}{/snippet}
			</IconButton>
			<span class="gg-player__name">{t.label}</span>
			{#if t.error}
				<span class="gg-player__error" role="alert"><TriangleAlert size="1em" aria-hidden="true" />{t.error}</span>
			{:else if loading}
				<span class="gg-player__wave"><Skeleton height="var(--space-6)" /></span>
			{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events -- el teclado va en el onkeydown del slider. -->
				<div
					class="gg-player__wave"
					role="slider"
					tabindex="0"
					aria-label={t.label}
					aria-valuemin={0}
					aria-valuemax={Math.round(dur(t))}
					aria-valuenow={Math.round(pos(t))}
					aria-valuetext="{fmt(pos(t))} de {fmt(dur(t))}"
					onkeydown={(e) => onWaveKey(e, t)}
					onclick={(e) => onWaveClick(e, t)}
				>
					{#each p as v, i (i)}
						<span class="gg-player__bar" class:gg-player__bar--played={i / BARS < frac} style:height="{Math.max(8, Math.round(v * 100))}%"></span>
					{/each}
				</div>
			{/if}
			<span class="gg-player__time">{fmt(pos(t))} / {fmt(dur(t))}</span>
		</div>
	{/each}
	{#if footer}<div class="gg-player__footer">{@render footer()}</div>{/if}
</div>

<style>
	.gg-player {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--surface-sunken);
		font-family: var(--font-sans);
	}

	.gg-player__track {
		display: grid;
		grid-template-columns: auto 8rem 1fr auto;
		align-items: center;
		gap: var(--space-3);
	}

	.gg-player__name {
		color: var(--text-primary);
		font-size: var(--text-body-sm-size);
		font-weight: 500;
	}

	.gg-player__wave {
		display: flex;
		align-items: center;
		gap: 2px;
		height: var(--space-8);
		cursor: pointer;
	}

	.gg-player__wave:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	.gg-player__bar {
		flex: 1;
		min-width: 2px;
		border-radius: var(--radius-full);
		background: var(--border-strong);
	}

	.gg-player__bar--played {
		background: var(--interactive-primary);
	}

	.gg-player__time {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
		font-variant-numeric: tabular-nums;
	}

	.gg-player__error {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-danger);
		font-size: var(--text-body-sm-size);
	}

	.gg-player__footer {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
	}
</style>
