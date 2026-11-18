
<script lang="ts">
	/**
	 * ExpandCollapse (§61, Fase 8) — envoltorio controlado para
	 * mostrar/ocultar contenido con una transición de alto, en vez de que
	 * cada consumidor escriba `{#if expanded}<div transition:slide>` a
	 * mano y reinvente `prefers-reduced-motion` cada vez. Por dentro es
	 * `slideToken` (`presets.ts`) — no un motor de animación propio.
	 *
	 * `expanded` no es bindable a propósito: quien lo usa ya tiene su
	 * propio `$state` para decidir si algo está expandido (un acordeón,
	 * un "mostrar más"...) — `ExpandCollapse` solo reacciona a esa prop,
	 * no intenta poseer el estado, mismo criterio que `DetailPage`
	 * (Fase 6) con `loading`.
	 */
	import type { Snippet } from "svelte";
	import { slideToken } from "./presets.js";
	import type { DurationToken } from "./tokens.js";

	interface Props {
		expanded: boolean;
		duration?: DurationToken;
		class?: string;
		children: Snippet;
	}

	let { expanded, duration = "normal", class: className = "", children }: Props = $props();
</script>

{#if expanded}
	<div class="gg-expand-collapse {className}" transition:slideToken={{ duration }}>
		{@render children()}
	</div>
{/if}
