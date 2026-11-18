<script lang="ts">
	/**
	 * TabNav (v1.4.0) — pestañas de NAVEGACIÓN por enlaces: cada pestaña es un `<a href>` dentro de un `<nav>`, y la
	 * activa lleva `aria-current="page"`. A diferencia de `Tabs` (estado en el cliente, sin URL), esta variante sirve
	 * cuando la pestaña forma parte de la dirección (`?tab=…`): funciona sin JavaScript, se puede compartir y respeta el
	 * botón «Atrás». El contenido de cada pestaña lo pinta quien la usa según la dirección.
	 *
	 * Aspecto: el mismo de `Tabs` (lista con línea inferior; la activa en `--text-interactive` con borde inferior de
	 * color) más un fondo `--surface-sunken` y peso 600 en la activa, para que se distinga por forma y no solo por color
	 * (WCAG 1.4.1). Como son enlaces, se recorren con Tab; no hay roving tabindex.
	 */
	import type { Snippet } from "svelte";

	export interface TabNavItem {
		href: string;
		label: string;
		/** La pestaña que se está viendo (`aria-current="page"`). Como máximo una. */
		current?: boolean;
	}

	interface Props {
		items: TabNavItem[];
		/** Nombre accesible del `<nav>` (obligatorio: hay más de una navegación en la página). */
		label: string;
		class?: string | undefined;
		children?: Snippet | undefined;
	}

	let { items, label, class: className = "", children }: Props = $props();
</script>

<nav aria-label={label} class="gg-tabnav {className}">
	<ul class="gg-tabnav__list">
		{#each items as item (item.href)}
			<li class="gg-tabnav__item">
				<a
					href={item.href}
					class="gg-tabnav__tab bc-pressable"
					class:gg-tabnav__tab--active={item.current === true}
					aria-current={item.current === true ? "page" : undefined}
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
	{@render children?.()}
</nav>

<style>
	.gg-tabnav__list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--border-subtle);
	}

	.gg-tabnav__tab {
		display: inline-block;
		padding: var(--space-2) var(--space-4);
		border-bottom: 2px solid transparent;
		border-start-start-radius: var(--radius-sm);
		border-start-end-radius: var(--radius-sm);
		margin-bottom: -1px;
		font-family: var(--font-sans);
		font-size: var(--text-body-sm-size);
		font-weight: var(--text-label-weight);
		color: var(--text-secondary);
		text-decoration: none;
		transition:
			color var(--duration-fast) var(--easing-standard),
			border-color var(--duration-fast) var(--easing-standard),
			background-color var(--duration-fast) var(--easing-standard),
			transform var(--duration-fast) var(--easing-standard);
	}

	.gg-tabnav__tab:hover {
		color: var(--text-primary);
	}

	.gg-tabnav__tab--active {
		background: var(--surface-sunken);
		color: var(--text-interactive);
		/* v1.9.0 — subrayado naranja de «dónde estás» (ver Tabs). */
		border-bottom-color: var(--indicator-accent);
		font-weight: 600;
	}

	.gg-tabnav__tab:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.gg-tabnav__tab {
			transition: none;
		}
	}
</style>
