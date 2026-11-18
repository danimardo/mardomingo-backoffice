<script lang="ts">
	/**
	 * Icon (v1.13.0) — componente unificado de iconografía para `@becall/design-system`.
	 *
	 * Renderiza el motivo solicitado en la familia activa del proyecto (`"lucide"` por
	 * defecto o `"clay"` cuando se configura con `<IconProvider family="clay">` /
	 * `setIconConfig({ family: "clay" })`), cambiando automáticamente a la variante
	 * simplificada Claymorphism por debajo de 24 px (`< 24px`) y garantizando IDs
	 * únicos por instancia para `<linearGradient>`, `<radialGradient>` y `<filter>`.
	 */
	import { resolveClayIcon } from "./catalog.generated.js";
	import { getIconConfig, reportMissingClayIcon } from "./context.svelte.js";
	import type { IconDefinition, IconFamilySelection, IconTone, LegacySvgSpec } from "./types.js";

	interface Props {
		/** Identificador kebab-case del icono (p. ej. `"plus"`, `"calendar"`, `"circle-check"`). */
		name?: string;
		/** Definición directa del icono (usada por los imports por ruta `./icons/<nombre>.svelte`). */
		icon?: IconDefinition;
		/** Tamaño CSS o numérico en px (`24` por defecto; `"1em"` para acompañar texto). */
		size?: string | number;
		/** Tono semántico en modo `"clay"` (`"inherit"` usa el tono por defecto del motivo). */
		tone?: IconTone;
		/** Fuerza una familia concreta en esta instancia o sigue la del proyecto (`"auto"`). */
		family?: IconFamilySelection;
		/** Nombre accesible para iconos informativos o de acción sin texto visible. */
		label?: string;
		/** Grosor de trazo en modo `"lucide"` (`2` por defecto). */
		strokeWidth?: string | number;
		/** Especificación SVG histórica para mantener compatibilidad DOM exacta en modo `"lucide"`. */
		legacySvg?: LegacySvgSpec;
		class?: string;
		style?: string;
		"aria-hidden"?: "true" | "false" | boolean;
		[key: string]: unknown;
	}

	let {
		name,
		icon,
		size = 24,
		tone = "inherit",
		family = "auto",
		label,
		strokeWidth = 2,
		legacySvg,
		class: className = "",
		style: styleProp,
		"aria-hidden": _ariaHidden,
		...rest
	}: Props = $props();

	function isSimplifiedSize(s: string | number): boolean {
		if (typeof s === "number") return s < 24;
		const str = String(s).trim();
		if (str.endsWith("rem") || str.endsWith("em")) {
			const num = parseFloat(str);
			return !Number.isNaN(num) && num * 16 < 24;
		}
		const num = parseFloat(str);
		return !Number.isNaN(num) && num < 24;
	}

	const rawUid = $props.id();
	const safeUid = $derived(`bc-clay-${rawUid.replace(/[^a-zA-Z0-9_-]/g, "")}`);

	const cfg = getIconConfig();
	const resolvedName = $derived(name ?? icon?.id ?? "");
	const isException = $derived(
		family === "lucide" || (family === "auto" && Boolean(resolvedName) && cfg.exceptions.includes(resolvedName))
	);
	const requestedFamily = $derived(family === "auto" ? (isException ? "lucide" : cfg.family) : family);
	const def = $derived(icon ?? (resolvedName ? resolveClayIcon(resolvedName) : undefined));

	const isMissingClay = $derived.by(() => {
		if (requestedFamily === "clay" && !def && resolvedName) {
			reportMissingClayIcon(resolvedName, cfg.onMissing);
			return true;
		}
		return false;
	});

	const effectiveFamily = $derived(requestedFamily === "clay" && def ? "clay" : "lucide");
	const simplified = $derived(isSimplifiedSize(size));
	const effectiveTone = $derived(tone === "inherit" ? (def?.defaultTone ?? "neutral") : tone);

	const clayVars = $derived(
		effectiveTone === "on-primary"
			? `--icon-clay-light:currentColor;--icon-clay-base:currentColor;--icon-clay-shade:currentColor;--icon-clay-detail:currentColor;--icon-clay-shadow:transparent;overflow:visible;`
			: `--icon-clay-light:var(--icon-clay-${effectiveTone}-light);` +
					`--icon-clay-base:var(--icon-clay-${effectiveTone}-base);` +
					`--icon-clay-shade:var(--icon-clay-${effectiveTone}-shade);` +
					`--icon-clay-detail:var(--icon-clay-${effectiveTone}-detail);` +
					`--icon-clay-shadow:var(--icon-clay-${effectiveTone}-shadow);` +
					`overflow:visible;`
	);

	const mergedStyle = $derived(
		effectiveFamily === "clay" ? (styleProp ? `${clayVars}${styleProp}` : clayVars) : styleProp
	);

	const clayBody = $derived(
		!def ? "" : simplified ? def.claySimplifiedSvg : def.clayFullSvg.replaceAll("__ID__", safeUid)
	);

	const lucideFallbackBody = `<circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />`;
	const lucideBody = $derived(legacySvg ? legacySvg.body : (def?.lucideSvg ?? lucideFallbackBody));

	const computedClass = $derived(
		legacySvg
			? className || undefined
			: ["lucide-icon", "lucide", resolvedName ? `lucide-${resolvedName}` : "", className].filter(Boolean).join(" ")
	);

	const hasLabel = $derived(Boolean(label && label.trim().length > 0));
</script>

{#if effectiveFamily === "clay" && def}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="-2 -2 28 28"
		fill="none"
		class={computedClass}
		style={mergedStyle}
		data-icon-family="clay"
		data-clay-icon={def.id}
		data-clay-style={def.style}
		data-clay-variant={simplified ? "simplified" : "full"}
		data-clay-tone={effectiveTone}
		data-clay-animated={def.animated ? "true" : undefined}
		role={hasLabel ? "img" : undefined}
		aria-label={hasLabel ? label : undefined}
		aria-hidden={hasLabel ? undefined : "true"}
		{...rest}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html clayBody}
	</svg>
{:else if legacySvg}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox={legacySvg.viewBox}
		fill={legacySvg.fill ?? "none"}
		stroke={legacySvg.stroke}
		stroke-width={legacySvg.strokeWidth}
		stroke-linecap={legacySvg.strokeLinecap}
		stroke-linejoin={legacySvg.strokeLinejoin}
		class={computedClass}
		style={styleProp}
		data-icon-family="lucide"
		data-icon-exception={isException && cfg.family === "clay" ? "true" : undefined}
		data-icon-fallback={isMissingClay ? "missing-clay" : undefined}
		role={hasLabel ? "img" : undefined}
		aria-label={hasLabel ? label : undefined}
		aria-hidden={hasLabel ? undefined : "true"}
		{...rest}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html legacySvg.body}
	</svg>
{:else}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
		class={computedClass}
		style={styleProp}
		data-icon-family="lucide"
		data-icon-exception={isException && cfg.family === "clay" ? "true" : undefined}
		data-icon-fallback={isMissingClay ? "missing-clay" : undefined}
		role={hasLabel ? "img" : undefined}
		aria-label={hasLabel ? label : undefined}
		aria-hidden={hasLabel ? undefined : "true"}
		{...rest}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html lucideBody}
	</svg>
{/if}
