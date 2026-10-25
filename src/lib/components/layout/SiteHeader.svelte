<script lang="ts">
	// Estados: página actual con `aria-current="page"`; el menú de cuenta cambia según la sesión. Teclado: enlaces y
	// menú nativos, con foco visible. Temas: tokens en claro y oscuro. Efectos reducidos: el cristal se anula con
	// `data-effects="reduced"` y con `prefers-reduced-transparency`, y pasa a fondo opaco.
	// Cabecera con marca, navegación y menú de cuenta. Material de cristal con alternativa opaca (DS-05, §16.10). El enlace
	// de la página actual lleva `aria-current="page"` (16.5).
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
	.chrome {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-3) var(--space-6);
		background: var(--sidebar-bg);
		border-bottom: 1px solid var(--sidebar-border);
		backdrop-filter: blur(var(--blur-sidebar));
		-webkit-backdrop-filter: blur(var(--blur-sidebar));
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
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-title);
		color: var(--color-text-primary);
		text-decoration: underline;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	nav > a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-3);
		color: var(--color-text-primary);
		text-decoration: underline;
	}

	nav > a[aria-current='page'] {
		font-weight: var(--font-weight-control);
	}

	nav > a:focus-visible,
	.brand:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
</style>
