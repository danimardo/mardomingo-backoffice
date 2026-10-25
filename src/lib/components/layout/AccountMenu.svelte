<script lang="ts">
	// Estados: sin sesión (enlaces de entrada y registro) o con sesión (menú cerrado o abierto, con «Administración» solo para
	// administradores). Teclado: Enter o Espacio abren el `<summary>` y los enlaces son nativos; sin JavaScript no hay Escape
	// (T361). Temas: tokens en claro y oscuro. Efectos reducidos: fondo sólido, sin cristal ni transiciones.
	// Menú de cuenta de la cabecera (T044; 16.5). Sin sesión, «Entrar» y «Crear cuenta»; con sesión, un menú con el panel, la
	// administración (solo a quien pasa su guarda) y «Salir». Es un `<details>`: abre y cierra sin JavaScript y el teclado
	// lo maneja el navegador. «Salir» lleva a la página de cierre de sesión (W15), que lo hace por formulario.
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		signedIn: boolean;
		isAdmin: boolean;
	}

	let { signedIn, isAdmin }: Props = $props();
</script>

{#if signedIn}
	<details class="menu">
		<summary>{m.account_menu_label()}</summary>
		<ul>
			<li><a href={resolve('/panel')}>{m.account_my_account()}</a></li>
			{#if isAdmin}
				<li><a href={resolve('/admin')}>{m.account_admin()}</a></li>
			{/if}
			<li><a href={resolve('/logout')}>{m.account_sign_out()}</a></li>
		</ul>
	</details>
{:else}
	<ul class="session">
		<li><a href={resolve('/login')}>{m.account_sign_in()}</a></li>
		<li><a href={resolve('/registro')}>{m.layout_nav_register()}</a></li>
	</ul>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.session {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	a,
	summary {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-3);
		color: var(--color-text-primary);
		text-decoration: none;
		cursor: pointer;
	}

	a {
		text-decoration: underline;
	}

	a:hover,
	summary:hover {
		text-decoration: underline;
	}

	a:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.menu {
		position: relative;
	}

	.menu ul {
		position: absolute;
		inset-inline-end: 0;
		z-index: 10;
		min-width: 12rem;
		padding: var(--space-2);
		background: var(--surface-solid-chrome);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 0.5rem);
	}

	.menu li a {
		display: flex;
	}
</style>
