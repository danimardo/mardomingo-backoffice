<script lang="ts">
	/**
	 * TranscriptRow (v1.12.0) — fila de transcripción con hora, hablante («Yo»/«Remoto»), original y
	 * traducción. Admite resaltado de búsqueda (`<mark>`), fila destino de búsqueda (`active`, con
	 * `aria-current`), fila parcial y fila de hueco (`kind="gap"`: «Sin transcripción de hh:mm a hh:mm»).
	 * Va como `role="row"` dentro de un `role="table"` que pone el consumidor (cabeceras Hora, Quién, Original,
	 * Traducción).
	 */
	import Info from "../icons/info.svelte";

	interface Props {
		time: string;
		speaker?: "me" | "remote";
		speakerLabels?: { me: string; remote: string };
		original?: string;
		translation?: string;
		originalLang?: string;
		translationLang?: string;
		partial?: boolean;
		highlight?: string | RegExp;
		active?: boolean;
		showOriginal?: boolean;
		kind?: "segment" | "gap";
		/** Texto de la fila de hueco (ya compuesto por el consumidor). */
		gapText?: string;
		onclick?: () => void;
		class?: string;
	}

	let {
		time,
		speaker = "remote",
		speakerLabels = { me: "Yo", remote: "Remoto" },
		original = "",
		translation = "",
		originalLang,
		translationLang,
		partial = false,
		highlight,
		active = false,
		showOriginal = true,
		kind = "segment",
		gapText = "",
		onclick,
		class: className = "",
		...rest
	}: Props = $props();

	function pieces(text: string): { text: string; hit: boolean }[] {
		if (!highlight || !text) return [{ text, hit: false }];
		const re = highlight instanceof RegExp ? new RegExp(highlight.source, highlight.flags.includes("g") ? highlight.flags : highlight.flags + "g") : new RegExp(highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
		const out: { text: string; hit: boolean }[] = [];
		let last = 0;
		for (const m of text.matchAll(re)) {
			if (m[0] === "") continue;
			if (m.index! > last) out.push({ text: text.slice(last, m.index), hit: false });
			out.push({ text: m[0], hit: true });
			last = m.index! + m[0].length;
		}
		if (last < text.length) out.push({ text: text.slice(last), hit: false });
		return out.length ? out : [{ text, hit: false }];
	}

	function focusIfActive(node: HTMLElement, isActive: boolean) {
		if (isActive) queueMicrotask(() => node.focus({ preventScroll: false }));
		return {
			update(next: boolean) {
				if (next) queueMicrotask(() => node.focus({ preventScroll: false }));
			}
		};
	}
</script>

{#snippet marked(text: string)}{#each pieces(text) as p, i (i)}{#if p.hit}<mark class="gg-transcript-row__mark">{p.text}</mark>{:else}{p.text}{/if}{/each}{/snippet}

{#if kind === "gap"}
	<div class="gg-transcript-row gg-transcript-row--gap {className}" role="row" {...rest}>
		<span class="gg-transcript-row__gap" role="cell"><span class="gg-transcript-row__gap-icon" aria-hidden="true"><Info size="1rem" aria-hidden="true" /></span>{gapText}</span>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -- la fila destino de una búsqueda recibe el foco. -->
	<div
		class="gg-transcript-row {className}"
		class:gg-transcript-row--clickable={Boolean(onclick)}
		class:gg-transcript-row--active={active}
		class:gg-transcript-row--partial={partial}
		class:gg-transcript-row--no-original={!showOriginal}
		role="row"
		tabindex={active ? -1 : undefined}
		aria-current={active ? "true" : undefined}
		onclick={onclick}
		use:focusIfActive={active}
		{...rest}
	>
		<span class="gg-transcript-row__time" role="cell">{time}</span>
		<span role="cell"><span class="gg-transcript-row__speaker gg-transcript-row__speaker--{speaker}">{speakerLabels[speaker]}</span></span>
		{#if showOriginal}<span class="gg-transcript-row__original" role="cell" lang={originalLang}>{@render marked(original)}</span>{/if}
		<span class="gg-transcript-row__translation" role="cell" lang={translationLang}>{@render marked(translation)}</span>
	</div>
{/if}

<style>
	.gg-transcript-row {
		display: grid;
		grid-template-columns: var(--space-16) var(--space-16) 1fr 1fr;
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border-subtle);
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		line-height: var(--text-body-sm-leading);
	}

	.gg-transcript-row--no-original {
		grid-template-columns: var(--space-16) var(--space-16) 1fr;
	}

	.gg-transcript-row--clickable {
		cursor: pointer;
	}

	.gg-transcript-row--clickable:hover {
		background: var(--surface-sunken);
	}

	.gg-transcript-row--active {
		background: var(--surface-accent-subtle);
	}

	.gg-transcript-row:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.gg-transcript-row__time {
		color: var(--text-muted);
		font-size: var(--text-caption-size);
		font-variant-numeric: tabular-nums;
	}

	.gg-transcript-row__speaker {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-sunken);
		color: var(--text-primary);
		font-size: var(--text-caption-size);
		font-weight: var(--text-label-weight);
		line-height: var(--text-body-leading);
	}

	.gg-transcript-row__speaker--me {
		background: var(--surface-accent-subtle);
	}

	.gg-transcript-row__original {
		color: var(--text-secondary);
	}

	.gg-transcript-row__translation {
		color: var(--text-primary);
	}

	.gg-transcript-row--partial .gg-transcript-row__translation {
		color: var(--text-muted);
	}

	.gg-transcript-row__mark {
		background: color-mix(in srgb, var(--accent-500) 40%, transparent);
		color: inherit;
		border-radius: var(--radius-xs);
	}

	.gg-transcript-row--gap {
		display: block;
		background: color-mix(in srgb, var(--status-warning) 14%, var(--surface));
	}

	.gg-transcript-row__gap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-primary);
	}

	.gg-transcript-row__gap-icon {
		display: inline-flex;
		color: var(--status-warning);
	}
</style>
