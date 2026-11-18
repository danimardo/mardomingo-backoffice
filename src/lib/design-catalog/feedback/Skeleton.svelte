<script lang="ts">
	/**
	 * Skeleton (§24) — un bloque de relleno con brillo animado, para el
	 * hueco de contenido que todavía no ha llegado. Solo la pieza base:
	 * `SkeletonText`/`SkeletonCard`/`SkeletonTable` del catálogo completo
	 * son composiciones de VARIOS `Skeleton` con tamaños concretos (una
	 * línea de texto, una tarjeta, una fila de tabla) — se consiguen
	 * componiendo esta pieza, no construyendo tres más iguales (mismo
	 * criterio que `List`/`Card` en Fase 4).
	 *
	 * `aria-hidden="true"` — es puramente decorativo. El anuncio real de
	 * "cargando" para lector de pantalla lo da el contenedor que lo use
	 * (`role="status"`/`aria-live`, o un `Spinner` al lado) — mismo
	 * patrón que ya usan los estados `loading` de `DataTable`/
	 * `StructuredList` desde Fase 4 (texto "Cargando…" + `aria-live`
	 * junto al indicador visual, nunca el indicador solo).
	 *
	 * `prefers-reduced-motion: reduce` desactiva el brillo (queda un
	 * bloque sólido, sigue comunicando "aquí va a aparecer contenido"
	 * sin depender del movimiento).
	 */
	interface Props {
		width?: string;
		height?: string;
		radius?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
		class?: string;
		style?: string;
	}

	let { width = "100%", height = "1rem", radius = "sm", class: className = "", style: styleProp = "" }: Props = $props();

	let inlineStyle = $derived(`width:${width};height:${height};border-radius:var(--radius-${radius});` + styleProp);
</script>

<div class="gg-skeleton {className}" style={inlineStyle} aria-hidden="true"></div>

<style>
	.gg-skeleton {
		box-sizing: border-box;
		background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-raised) 50%, var(--surface-sunken) 75%);
		background-size: 200% 100%;
		/* 1.6s, no un --duration-*: la escala fast/normal/slow (120/200/
		   320ms) es para MICRO-interacciones (hover, focus, apertura de un
		   menú) — un brillo de skeleton es un bucle decorativo de fondo,
		   no una respuesta a una acción, y a 320ms parpadearía en vez de
		   deslizarse. Mismo motivo por el que las 4 intensidades de
		   cristal tienen su propia escala aparte de motion. */
		animation: gg-skeleton-shimmer 1.6s ease-in-out infinite;
	}

	@keyframes gg-skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-skeleton {
			animation: none;
			background: var(--surface-sunken);
		}
	}
</style>
