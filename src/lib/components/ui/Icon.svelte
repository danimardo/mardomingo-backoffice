<script lang="ts">
	// Icono decorativo: `aria-hidden` siempre. Quien necesite un nombre accesible lo pone en el texto cercano.
	import { ICONS, type IconName } from './icons';

	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 18 }: Props = $props();

	const def = $derived(ICONS[name]);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={def.filled === true ? 'currentColor' : 'none'}
	stroke={def.filled === true ? 'none' : 'currentColor'}
	stroke-width={def.strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each def.shapes as shape (shape.d)}
		<path
			d={shape.d}
			fill={shape.dot === true ? 'currentColor' : undefined}
			stroke={shape.dot === true ? 'none' : undefined}
		/>
	{/each}
</svg>
