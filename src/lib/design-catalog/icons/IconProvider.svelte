<script lang="ts">
	/**
	 * IconProvider (v1.13.0) — proveedor de contexto para elegir la familia de iconos
	 * (`"lucide"` por defecto o `"clay"`) y las excepciones en una app o subárbol.
	 */
	import { untrack, type Snippet } from "svelte";
	import { setIconConfig } from "./context.svelte.js";
	import type { IconFamily, MissingIconPolicy } from "./types.js";

	interface Props {
		family?: IconFamily;
		exceptions?: readonly string[];
		onMissing?: MissingIconPolicy;
		children: Snippet;
	}

	let { family = "lucide", exceptions = [], onMissing = "warn", children }: Props = $props();

	const cfg = untrack(() => setIconConfig({ family, exceptions, onMissing }));

	$effect(() => {
		cfg.family = family;
		cfg.exceptions = exceptions;
		cfg.onMissing = onMissing;
	});
</script>

{@render children()}
