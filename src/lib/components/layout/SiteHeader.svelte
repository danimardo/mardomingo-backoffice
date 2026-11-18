<script lang="ts">
	// Estados: página actual con `aria-current="page"`; el menú de cuenta cambia según la sesión. Teclado: enlaces y
	// menú nativos, con foco visible. Temas: tokens en claro y oscuro. Efectos reducidos: el cristal se anula con
	// `data-effects="reduced"` y con `prefers-reduced-transparency`, y pasa a fondo opaco.
	// Cabecera con marca, navegación y menú de cuenta. Material de cristal con alternativa opaca (DS-05, §16.10). El enlace
	// de la página actual lleva `aria-current="page"` (16.5). Los enlaces en reposo van subrayados: excepción aprobada por el
	// propietario a DS-10 (2026-10-25), porque el color solo no distingue el enlace (WCAG 1.4.1).
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import AccountMenu from './AccountMenu.svelte';

	interface Props {
		signedIn?: boolean;
		isAdmin?: boolean;
	}

	let { signedIn = false, isAdmin = false }: Props = $props();
	const pricesHref = resolve('/precios');
</script>

<header class="chrome" data-surface="glass">
	<a class="brand" href={resolve('/')}>{m.common_app_name()}</a>
	<nav aria-label={m.layout_nav_label()}>
		<a href={pricesHref} aria-current={page.url.pathname === pricesHref ? 'page' : undefined}
			>{m.layout_nav_prices()}</a
		>
		<AccountMenu {signedIn} {isAdmin} />
	</nav>
</header>

<style>
	/* Píldora flotante y centrada sobre el contenido (sin barra a todo el ancho). Cristal con alternativa opaca. */
	.chrome {
		position: fixed;
		top: var(--space-4);
		left: 50%;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-6);
		box-sizing: border-box;
		width: max-content;
		max-width: calc(100% - var(--space-6));
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-5);
		transform: translateX(-50%);
		background: var(--sidebar-bg);
		border: 1px solid var(--sidebar-border);
		border-radius: 999px;
		box-shadow: var(--shadow-card-hero);
		backdrop-filter: blur(var(--blur-sidebar)) saturate(var(--material-saturate));
		-webkit-backdrop-filter: blur(var(--blur-sidebar)) saturate(var(--material-saturate));
	}

	@supports not (backdrop-filter: blur(1px)) {
		.chrome {
			background: var(--surface-solid-chrome);
		}
	}

	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-subtitle);
		letter-spacing: -0.01em;
		white-space: nowrap;
		color: var(--color-text-primary);
		text-decoration: none;
	}

	nav {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	nav > a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-3);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		text-decoration: none;
	}

	nav > a:hover,
	nav > a[aria-current='page'] {
		color: var(--color-text-primary);
		background: var(--hover-tint);
	}

	nav > a:focus-visible,
	.brand:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	@media (max-width: 40rem) {
		.chrome {
			flex-wrap: wrap;
			justify-content: center;
			padding: var(--space-1) var(--space-3);
			border-radius: var(--radius-xl);
		}
	}
</style>
