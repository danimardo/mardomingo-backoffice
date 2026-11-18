<script lang="ts">
	/**
	 * AppShell (§9) — el esqueleto de una aplicación completa: cabecera
	 * (fija arriba) + panel lateral (Desktop) o barra inferior (Mobile) +
	 * contenido principal desplazable. Del catálogo de ~19 piezas de §9
	 * (`MainContent`/`TopBar`/`AppBar`/`NavigationRail`/`MobileHeader`/
	 * `Footer`/`ContextSidebar`/`RightPanel`/`SplitPane`/
	 * `DashboardLayout`/...) solo `AppShell` está en la lista curada de
	 * Fase 6 (§69) — el resto son variantes de composición del mismo
	 * hueco (`header`), o layouts que el propio `children` de `AppShell`
	 * puede componer sin una pieza dedicada (una `Grid`/`Flex` de
	 * Fase 1 ya cubre `SplitPane`/`DashboardLayout`).
	 *
	 * `header`/`sidebar`/`bottomNav` son huecos (`Snippet`) para que el
	 * consumidor traiga lo que quiera — normalmente `<Sidebar>` (Fase 3)
	 * en `sidebar` y `<BottomNavigation>` (Fase 3) en `bottomNav` — en
	 * vez de que `AppShell` imponga un `TopBar`/`NavigationRail` propios
	 * que ninguna pieza curada de Fase 6 pide.
	 *
	 * Nivel decidido por el ANCHO DEL CONTENEDOR (`bind:clientWidth`),
	 * mismo patrón que `AdaptiveDataView`/`ResponsiveActions` — pero con
	 * UN solo corte (Mobile/Desktop, no tres niveles): a diferencia de
	 * una vista de datos, el propio esqueleto de la app solo tiene dos
	 * formas razonables (con panel lateral, o con barra inferior), no
	 * una tercera intermedia — decisión de alcance documentada también en
	 * `docs/ROADMAP.md`.
	 *
	 * `contain: layout` en la raíz — mismo motivo que ya resolvió
	 * `BottomNavigation` "suelto" en la guía de estilos desde Fase 3: sin
	 * un ancestro que forme "containing block", su `position: fixed` se
	 * ancla al viewport real en vez de quedar contenido dentro de
	 * `AppShell`. Aquí se resuelve DE RAÍZ en el propio esqueleto, no caso
	 * a caso en cada demo.
	 *
	 * v1.9.0 — apariencia BeCall por defecto:
	 *   - `background` (true por defecto) monta `AnimatedBackground` dentro
	 *     del esqueleto (`position="fill"`): fondo ambiental con la paleta,
	 *     intensidad y movimiento de `createAppearanceController` (sin
	 *     controlador: corporativa, sutil, en movimiento). `background={false}`
	 *     vuelve al fondo liso `--surface` de antes.
	 *   - La cabecera es cristal en el flujo (sin desenfoque) y queda por
	 *     encima del cuerpo (`--z-sticky`), así sus menús desplegables pasan
	 *     por delante del panel lateral y del contenido.
	 *   - El esqueleto aísla su apilamiento (`isolation: isolate`) para que el
	 *     fondo, en `z-index: -1`, quede detrás del contenido y dentro del
	 *     esqueleto. Los superpuestos van a `<body>` (portal) y no se ven
	 *     afectados.
	 */
	import { untrack, type Snippet } from "svelte";
	import AnimatedBackground from "../appearance/AnimatedBackground.svelte";
	import { setIconConfig } from "../icons/context.svelte.js";
	import type { IconFamily } from "../icons/types.js";

	interface Props {
		header?: Snippet;
		sidebar?: Snippet;
		bottomNav?: Snippet;
		children: Snippet;
		/** Ancho de contenedor (px) por debajo del cual pasa de panel lateral a barra inferior. */
		mobileBreakpoint?: number;
		/** v1.9.0 — fondo ambiental animado detrás del esqueleto. `false`: fondo liso `--surface`. */
		background?: boolean;
		/** v1.13.0 — familia de iconos de la aplicación (`"lucide"` por defecto o `"clay"`). */
		iconFamily?: IconFamily;
		/** v1.13.0 — lista de iconos que se mantienen en `"lucide"` cuando `iconFamily="clay"`. */
		iconExceptions?: readonly string[];
		class?: string;
	}

	let {
		header,
		sidebar,
		bottomNav,
		children,
		mobileBreakpoint = 720,
		background = true,
		iconFamily,
		iconExceptions,
		class: className = ""
	}: Props = $props();

	const iconCfg = untrack(() =>
		iconFamily !== undefined || iconExceptions !== undefined
			? setIconConfig({ family: iconFamily ?? "lucide", exceptions: iconExceptions ?? [] })
			: null
	);

	$effect(() => {
		if (iconCfg) {
			if (iconFamily !== undefined) iconCfg.family = iconFamily;
			if (iconExceptions !== undefined) iconCfg.exceptions = iconExceptions;
		}
	});

	let width = $state(0);
	let tier = $derived(width < mobileBreakpoint ? "mobile" : "desktop");
	let showBottomNav = $derived(tier === "mobile" && !!bottomNav);
</script>

<div bind:clientWidth={width} class="gg-app-shell {className}" class:gg-app-shell--ambient={background} data-tier={tier} data-icon-family={iconFamily}>
	{#if background}
		<AnimatedBackground position="fill" />
	{/if}
	{#if header}
		<div class="gg-app-shell__header bc-glass-inline bc-glass--standard">{@render header()}</div>
	{/if}
	<div class="gg-app-shell__body">
		{#if tier === "desktop" && sidebar}
			<div class="gg-app-shell__sidebar">{@render sidebar()}</div>
		{/if}
		<main class="gg-app-shell__main" class:gg-app-shell__main--with-bottom-nav={showBottomNav}>
			{@render children()}
		</main>
	</div>
	{#if showBottomNav}
		{@render bottomNav?.()}
	{/if}
</div>

<style>
	.gg-app-shell {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--surface);
		contain: layout;
		position: relative;
		isolation: isolate;
	}

	.gg-app-shell--ambient {
		background: transparent;
	}

	.gg-app-shell__header {
		flex-shrink: 0;
		position: relative;
		z-index: var(--z-sticky);
		/* v1.9.0 — cristal en el flujo; con efectos apagados, --surface. */
		--bc-glass-tint: var(--surface);
		--bc-glass-shadow: 0 0 0 transparent;
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-app-shell__body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.gg-app-shell__sidebar {
		flex-shrink: 0;
		/* v1.9.0 — el panel lateral ocupa todo el alto del cuerpo: con el fondo
		   ambiental detrás, un lateral más corto que la ventana se notaría. */
		display: flex;
	}

	.gg-app-shell__main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	.gg-app-shell__main--with-bottom-nav {
		padding-bottom: calc(var(--space-12) + env(safe-area-inset-bottom));
	}
</style>
