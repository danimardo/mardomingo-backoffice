<script lang="ts">
	/**
	 * AppearanceSettings (v1.9.0) — los controles de apariencia que puede
	 * cambiar la persona usuaria: paleta del fondo, intensidad, fondo
	 * animado y nivel de efectos. Pensado para una página o un diálogo de
	 * Ajustes.
	 *
	 * Uso habitual: pásale el `controller` (createAppearanceController) y
	 * aplica cada cambio al momento; con `onchange` la aplicación guarda las
	 * preferencias donde quiera. `value` es bindable por si se prefiere
	 * gestionar el estado fuera.
	 *
	 * Accesible: cada control lleva su etiqueta visible y una descripción
	 * del efecto; ninguno depende solo del color.
	 */
	import { Stack } from "../primitives/index.js";
	import { FormField, Select, Switch } from "../forms/index.js";
	import { SegmentedControl } from "../navigation/index.js";
	import { AMBIENT_INTENSITIES, AMBIENT_PALETTES } from "./palettes.generated.js";
	import { DEFAULT_APPEARANCE, EFFECTS_LEVELS, normalizeAppearance } from "./controller.js";
	import type { AppearanceController, AppearancePreferences } from "./controller.js";

	interface Props {
		value?: AppearancePreferences;
		controller?: AppearanceController | undefined;
		onchange?: ((value: AppearancePreferences) => void) | undefined;
		class?: string;
	}

	let { value = $bindable({ ...DEFAULT_APPEARANCE }), controller, onchange, class: className = "" }: Props = $props();

	let palette = $derived(value.palette as string);
	let paletteDescription = $derived(AMBIENT_PALETTES.find((p) => p.id === value.palette)?.description ?? "");
	let effectsDescription = $derived(EFFECTS_LEVELS.find((e) => e.id === value.effects)?.description ?? "");

	function update(next: Partial<AppearancePreferences>) {
		value = normalizeAppearance({ ...value, ...next });
		controller?.set(value);
		onchange?.(value);
	}

	const intensityItems = AMBIENT_INTENSITIES.map((i) => ({ value: i.id, label: i.label }));
	const effectsItems = EFFECTS_LEVELS.map((e) => ({ value: e.id, label: e.label }));
</script>

<Stack gap={5} class="bc-appearance-settings {className}">
	<FormField label="Paleta del fondo" description={paletteDescription}>
		{#snippet children({ id, describedBy })}
			<Select
				{id}
				aria-describedby={describedBy}
				value={palette}
				onchange={(e) => update({ palette: (e.currentTarget as HTMLSelectElement).value as AppearancePreferences["palette"] })}
			>
				{#each AMBIENT_PALETTES as p (p.id)}
					<option value={p.id}>{p.label}</option>
				{/each}
			</Select>
		{/snippet}
	</FormField>

	<div class="bc-appearance-settings__group">
		<span class="bc-appearance-settings__label">Intensidad del fondo</span>
		<SegmentedControl
			label="Intensidad del fondo"
			items={intensityItems}
			bind:value={() => value.intensity, (v) => update({ intensity: v as AppearancePreferences["intensity"] })}
		/>
	</div>

	<Switch
		label="Fondo animado"
		checked={value.animated}
		onchange={(e) => update({ animated: (e.currentTarget as HTMLInputElement).checked })}
	/>

	<div class="bc-appearance-settings__group">
		<span class="bc-appearance-settings__label">Efectos visuales</span>
		<SegmentedControl
			label="Efectos visuales"
			items={effectsItems}
			bind:value={() => value.effects, (v) => update({ effects: v as AppearancePreferences["effects"] })}
		/>
		<span class="bc-appearance-settings__hint">{effectsDescription}</span>
	</div>
</Stack>

<style>
	.bc-appearance-settings__group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.bc-appearance-settings__label {
		font-family: var(--font-sans);
		font-size: var(--text-label-size);
		line-height: var(--text-label-leading);
		font-weight: var(--text-label-weight);
		color: var(--text-primary);
	}

	.bc-appearance-settings__hint {
		font-family: var(--font-sans);
		font-size: var(--text-caption-size);
		line-height: var(--text-caption-leading);
		color: var(--text-secondary);
	}
</style>
