<script lang="ts">
	// GENERADO por scripts/generate-clay-icons.mjs — no editar a mano.
	import Icon from "./Icon.svelte";
	import { CLAY_CATALOG } from "./catalog.generated.js";
	import type { IconFamilySelection, IconTone } from "./types.js";

	interface Props {
		size?: string | number;
		tone?: IconTone;
		family?: IconFamilySelection;
		label?: string;
		strokeWidth?: string | number;
		class?: string;
		style?: string;
		"aria-hidden"?: "true" | "false" | boolean;
		[key: string]: unknown;
	}

	let props: Props = $props();
	const def = CLAY_CATALOG["circle-help"]!; 
</script>

<Icon {...props} name="circle-help" icon={def} />
