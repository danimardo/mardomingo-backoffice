export { default as Icon } from "./Icon.svelte";
export { default as IconProvider } from "./IconProvider.svelte";
export { setIconConfig, getIconConfig, reportMissingClayIcon, resetMissingIconWarnings } from "./context.svelte.js";
export {
	CLAY_ICON_NAMES,
	BLOCK_A_ICON_NAMES,
	CLAY_ICON_ALIASES,
	CLAY_CATALOG,
	resolveClayIcon
} from "./catalog.generated.js";
export type { ClayIconName, BlockAIconName } from "./catalog.generated.js";
export type {
	IconFamily,
	IconFamilySelection,
	IconTone,
	ClayIconStyle,
	IconCatalogBlock,
	MissingIconPolicy,
	IconConfig,
	LegacySvgSpec,
	IconDefinition
} from "./types.js";
