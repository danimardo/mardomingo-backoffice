// Apariencia (v1.9.0): fondo ambiental animado, preferencias de apariencia
// y su panel de ajustes. El CSS (material de cristal, fondo, animaciones)
// llega con tokens.css; este módulo aporta los componentes y el controlador.
export { default as AnimatedBackground } from "./AnimatedBackground.svelte";
export { default as AppearanceSettings } from "./AppearanceSettings.svelte";

export {
	createAppearanceController,
	normalizeAppearance,
	DEFAULT_APPEARANCE,
	EFFECTS_LEVELS
} from "./controller.js";
export type { AppearanceController, AppearancePreferences, EffectsLevel } from "./controller.js";

export {
	AMBIENT_PALETTES,
	AMBIENT_INTENSITIES,
	DEFAULT_AMBIENT_PALETTE,
	DEFAULT_AMBIENT_INTENSITY
} from "./palettes.generated.js";
export type { AmbientPalette, AmbientIntensity } from "./palettes.generated.js";
