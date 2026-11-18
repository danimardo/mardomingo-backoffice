<script lang="ts">
	/**
	 * Badge — indicador pequeño para superponer sobre un icono/avatar:
	 * punto de "hay algo nuevo" o contador numérico (candidato #3 del
	 * listado de huecos detectado en la auditoría del catálogo, ver
	 * docs/ROADMAP.md — no es uno de los 14 explícitamente pedidos, pero
	 * es la pieza que hace falta para que `Avatar` pueda mostrar
	 * "presencia" sin inventar un segundo mini-componente, y para que una
	 * campana de notificaciones pueda llevar contador sin que cada
	 * consumidor reinvente el posicionamiento absoluto).
	 *
	 * `Badge` NO se posiciona a sí mismo dentro del flujo normal — cuando
	 * `overlay` es `true` se ancla con `position:absolute` a la esquina
	 * indicada (`position` prop) y espera que el contenedor del consumidor
	 * tenga `position:relative` (documentado en `docs/COMPONENTS.md`,
	 * mismo contrato que un badge de notificaciones nativo). Sin
	 * `overlay`, se pinta en flujo normal (p. ej. junto a un título).
	 *
	 * Mismo vocabulario de tono que `Chip`/`DataCardStatus`. El valor
	 * numérico nunca es el único portador de significado por color: el
	 * texto en sí (el número, o nada si es un punto) ya lo dice todo —
	 * el tono es refuerzo visual, no el único canal (§12 ux.md,
	 * "no dependas solo del color").
	 *
	 * Contraste del modo CONTADOR (texto encima de fondo sólido — par
	 * nuevo, primero desde `WindowControls`/Fase 7, mismo método: no se
	 * asume, se mide): los alias `--status-X` CAMBIAN de peldaño entre
	 * temas (claro = peldaño oscuro 700/800 para servir de TEXTO; oscuro
	 * = peldaño claro 300/400 para lo mismo) — así que blanco encima de
	 * `--status-X` falla estrepitosamente en oscuro (peldaño claro bajo
	 * blanco). La solución es la misma que `WindowControls`: un peldaño
	 * FIJO de la escala (no cambia por tema, `danger-600` ya lo probó)
	 * con blanco encima, verificado por fórmula para los cinco tonos:
	 *
	 * Valores BeCall v1.0.0 (comprobados en cada ejecución por
	 * scripts/generate-tokens.mjs, ver scripts/contrast-report.json):
	 * ✓ blanco / --success-800 (#135133): 9.32:1
	 * ✓ blanco / --warning-800 (#5F400F): 9.43:1
	 * ✓ blanco / --danger-600 (#B42318): 6.57:1 (mismo peldaño que WindowControls)
	 * ✓ blanco / --info-600 (#006E89): 5.85:1
	 * ✓ blanco / --neutral-600 (#4F6673): 6.03:1
	 *
	 * El modo PUNTO no lleva texto encima (WCAG 1.4.11, ≥3:1, no 4.5:1)
	 * así que sí usa `--status-X`/`--text-disabled` sin más, igual que el
	 * punto de `DataCardStatus`.
	 */
	interface Props {
		/** Si se omite (o es `undefined`), pinta un punto sin número — "hay algo nuevo" sin cuantificar. */
		count?: number;
		/** A partir de qué número se trunca a "`max`+" (p. ej. `99+`). */
		max?: number;
		/** v1.9.0 — "accent": naranja corporativo para «nuevo», «destacado» o un contador de énfasis; no es un aviso. */
		tone?: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
		overlay?: boolean;
		position?: "top-end" | "top-start" | "bottom-end" | "bottom-start";
		/** Nombre accesible cuando el badge no tiene texto visible propio (modo punto) — p. ej. "Notificaciones sin leer". Si se omite en modo punto, el badge es puramente decorativo (`aria-hidden`). */
		label?: string;
		class?: string;
	}

	let { count, max = 99, tone = "danger", overlay = false, position = "top-end", label, class: className = "" }: Props = $props();

	let isDot = $derived(count == null);
	let display = $derived(count != null && count > max ? `${max}+` : count != null ? String(count) : "");
</script>

{#if isDot}
	<span
		class="gg-badge gg-badge--dot gg-badge--{tone} {overlay ? `gg-badge--overlay gg-badge--${position}` : ''} {className}"
		role={label ? "status" : undefined}
		aria-hidden={label ? undefined : "true"}
	>
		{#if label}<span class="gg-badge__sr">{label}</span>{/if}
	</span>
{:else}
	<span
		class="gg-badge gg-badge--count gg-badge--{tone} {overlay ? `gg-badge--overlay gg-badge--${position}` : ''} {className}"
		role="status"
	>
		{display}
		{#if label}<span class="gg-badge__sr"> {label}</span>{/if}
	</span>
{/if}

<style>
	.gg-badge {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		border: 2px solid var(--surface);
		font-family: var(--font-sans);
		font-weight: var(--text-label-weight);
		line-height: 1;
	}

	.gg-badge--dot {
		width: var(--space-3);
		height: var(--space-3);
	}

	.gg-badge--count {
		min-width: var(--space-5);
		height: var(--space-5);
		padding-inline: var(--space-1);
		font-size: var(--text-caption-size);
		/* Blanco fijo: ver nota de contraste arriba — los peldaños fijos
		   elegidos (no los alias --status-X, que cambian de peldaño por
		   tema) ya están verificados con blanco encima en los dos temas. */
		color: var(--color-white);
	}

	.gg-badge--dot.gg-badge--success {
		background: var(--status-success);
	}

	.gg-badge--dot.gg-badge--warning {
		background: var(--status-warning);
	}

	.gg-badge--dot.gg-badge--danger {
		background: var(--status-danger);
	}

	.gg-badge--dot.gg-badge--info {
		background: var(--status-info);
	}

	.gg-badge--dot.gg-badge--neutral {
		background: var(--text-disabled);
	}

	.gg-badge--count.gg-badge--success {
		background: var(--success-800);
	}

	.gg-badge--count.gg-badge--warning {
		background: var(--warning-800);
	}

	.gg-badge--count.gg-badge--danger {
		background: var(--danger-600);
	}

	.gg-badge--count.gg-badge--info {
		background: var(--info-600);
	}

	.gg-badge--count.gg-badge--neutral {
		background: var(--neutral-600);
	}

	/* v1.9.0 — énfasis naranja. Contador: naranja corporativo fijo con texto
	   oscuro (--color-on-accent, ≥4,5:1 en ambos temas; el blanco no llega).
	   Punto: --indicator-accent (≥3:1 sobre cualquier superficie). */
	.gg-badge--dot.gg-badge--accent {
		background: var(--indicator-accent);
	}

	.gg-badge--count.gg-badge--accent {
		background: var(--accent-500);
		color: var(--color-on-accent);
	}

	.gg-badge--overlay {
		position: absolute;
		z-index: var(--z-raise);
	}

	.gg-badge--top-end {
		top: 0;
		right: 0;
		transform: translate(35%, -35%);
	}

	.gg-badge--top-start {
		top: 0;
		left: 0;
		transform: translate(-35%, -35%);
	}

	.gg-badge--bottom-end {
		bottom: 0;
		right: 0;
		transform: translate(35%, 35%);
	}

	.gg-badge--bottom-start {
		bottom: 0;
		left: 0;
		transform: translate(-35%, 35%);
	}

	.gg-badge__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
