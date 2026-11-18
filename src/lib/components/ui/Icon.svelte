<script lang="ts">
	// Icono de Lucide (ADR 0009). Decorativo por defecto: `aria-hidden`. Con `label` pasa a ser informativo
	// (`role="img"` + `aria-label`). Hereda el color con `currentColor`; en SSR es un `<svg>` sin JavaScript.
	import { ICONS, type IconName } from './icons';

	interface Props {
		name: IconName;
		size?: number;
		/** Grosor del trazo (el estándar de Lucide es 2). */
		strokeWidth?: number;
		/** Nombre accesible; sin él, el icono es decorativo. */
		label?: string;
	}

	let { name, size = 18, strokeWidth = 2, label }: Props = $props();

	const Glyph = $derived(ICONS[name]);
</script>

{#if label}
	<Glyph {size} {strokeWidth} role="img" aria-label={label} focusable="false" />
{:else}
	<Glyph {size} {strokeWidth} aria-hidden="true" focusable="false" />
{/if}
