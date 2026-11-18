export { default as Box } from "./Box.svelte";
export { default as Flex } from "./Flex.svelte";
export { default as Stack } from "./Stack.svelte";
// VStack es un alias explícito de Stack (mismo componente) — la
// especificación usa ambos nombres indistintamente (§8.2).
export { default as VStack } from "./Stack.svelte";
export { default as HStack } from "./HStack.svelte";
export { default as Grid } from "./Grid.svelte";
export { default as Surface } from "./Surface.svelte";

export type {
	AlignValue,
	ElevationToken,
	GlassIntensity,
	SurfaceMaterial,
	JustifyValue,
	RadiusToken,
	SpaceToken,
	SurfaceToken
} from "./types.js";
