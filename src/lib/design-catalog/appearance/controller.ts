/**
 * createAppearanceController (v1.9.0) — escribe las preferencias de
 * apariencia como atributos de <html> (o del elemento raíz que se pase):
 *
 *   data-ambient-palette    paleta del fondo ambiental
 *   data-ambient-intensity  opacidad de las manchas
 *   data-ambient-motion     "on" | "off" (movimiento del fondo)
 *   data-effects            "full" | "lite" | "off" (cristal y animaciones)
 *
 * Todo el aspecto vive en CSS (tokens.css + appearance.css): sin este
 * controlador se aplican los valores por defecto (corporativa, sutil, en
 * movimiento, efectos completos). No guarda nada: persistir las
 * preferencias es cosa de la aplicación (localStorage, ajustes de Tauri...),
 * igual que el tema. Las preferencias del sistema (movimiento reducido,
 * menos transparencia, más contraste, colores forzados) prevalecen siempre
 * sobre estas.
 */
import {
	AMBIENT_INTENSITIES,
	AMBIENT_PALETTES,
	DEFAULT_AMBIENT_INTENSITY,
	DEFAULT_AMBIENT_PALETTE
} from "./palettes.generated.js";
import type { AmbientIntensity, AmbientPalette } from "./palettes.generated.js";

/** full: cristal con desenfoque y animaciones · lite: sin desenfoque ni translucidez · off: superficies sólidas y sin animaciones decorativas. */
export type EffectsLevel = "full" | "lite" | "off";

export const EFFECTS_LEVELS: readonly { id: EffectsLevel; label: string; description: string }[] = [
	{ id: "full", label: "Completos", description: "Cristal con desenfoque, fondo y animaciones." },
	{ id: "lite", label: "Reducidos", description: "Sin desenfoque ni transparencia. Para equipos lentos." },
	{ id: "off", label: "Sin efectos", description: "Superficies sólidas y sin animaciones decorativas." }
];

export interface AppearancePreferences {
	palette: AmbientPalette;
	intensity: AmbientIntensity;
	/** Movimiento del fondo ambiental. */
	animated: boolean;
	effects: EffectsLevel;
}

export const DEFAULT_APPEARANCE: Readonly<AppearancePreferences> = {
	palette: DEFAULT_AMBIENT_PALETTE,
	intensity: DEFAULT_AMBIENT_INTENSITY,
	animated: true,
	effects: "full"
};

export interface AppearanceController {
	set(next: Partial<AppearancePreferences>): void;
	get(): AppearancePreferences;
	dispose(): void;
}

const PALETTE_IDS = new Set<string>(AMBIENT_PALETTES.map((p) => p.id));
const INTENSITY_IDS = new Set<string>(AMBIENT_INTENSITIES.map((i) => i.id));
const EFFECT_IDS = new Set<string>(EFFECTS_LEVELS.map((e) => e.id));

/** Devuelve unas preferencias válidas a partir de un valor desconocido (p. ej. leído de almacenamiento). */
export function normalizeAppearance(value: unknown): AppearancePreferences {
	const v = (value ?? {}) as Partial<Record<keyof AppearancePreferences, unknown>>;
	return {
		palette: typeof v.palette === "string" && PALETTE_IDS.has(v.palette) ? (v.palette as AmbientPalette) : DEFAULT_APPEARANCE.palette,
		intensity:
			typeof v.intensity === "string" && INTENSITY_IDS.has(v.intensity) ? (v.intensity as AmbientIntensity) : DEFAULT_APPEARANCE.intensity,
		animated: typeof v.animated === "boolean" ? v.animated : DEFAULT_APPEARANCE.animated,
		effects: typeof v.effects === "string" && EFFECT_IDS.has(v.effects) ? (v.effects as EffectsLevel) : DEFAULT_APPEARANCE.effects
	};
}

/** Aplica las preferencias sobre `root` y las mantiene; llama a `dispose()` al desmontar. */
export function createAppearanceController(
	root: HTMLElement = document.documentElement,
	initial: Partial<AppearancePreferences> = {}
): AppearanceController {
	let prefs = normalizeAppearance({ ...DEFAULT_APPEARANCE, ...initial });

	const apply = () => {
		root.dataset.ambientPalette = prefs.palette;
		root.dataset.ambientIntensity = prefs.intensity;
		root.dataset.ambientMotion = prefs.animated ? "on" : "off";
		root.dataset.effects = prefs.effects;
	};
	apply();

	return {
		set(next) {
			prefs = normalizeAppearance({ ...prefs, ...next });
			apply();
		},
		get() {
			return { ...prefs };
		},
		dispose() {
			delete root.dataset.ambientPalette;
			delete root.dataset.ambientIntensity;
			delete root.dataset.ambientMotion;
			delete root.dataset.effects;
		}
	};
}
