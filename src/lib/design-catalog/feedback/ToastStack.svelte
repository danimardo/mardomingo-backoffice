<script lang="ts">
	/**
	 * ToastStack — contenedor posicionado (`position: fixed`, uno de los
	 * cuatro rincones del viewport) que apila `Toast`s. Deliberadamente
	 * SIN estado propio: recibe `toasts`/`onDismiss` como props en vez de
	 * importar `createToastStore` directamente — así sirve tanto para el
	 * store de `toastStore.svelte.ts` como para cualquier otro origen de
	 * datos (tests, Storybook-like demos) sin acoplarse a una
	 * implementación concreta, mismo criterio que `DataTable` recibe
	 * `selected`/`onRowClick` en vez de gestionar su propio Set interno.
	 *
	 * `use:portal` al `<body>` — igual que `Dialog`/`Modal` — para que
	 * `position: fixed` cubra el viewport real sin que un ancestro con
	 * `transform`/`overflow` lo atrape (ver `feedback/portal.ts`).
	 */
	import { portal } from "./portal.js";
	import Toast from "./Toast.svelte";
	import type { ToastItem } from "./toastStore.svelte.js";

	interface Props {
		toasts: ToastItem[];
		onDismiss: (id: string) => void;
		placement?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
	}

	let { toasts, onDismiss, placement = "top-right" }: Props = $props();
</script>

<div class="gg-toast-stack gg-toast-stack--{placement}" role="region" aria-label="Notificaciones" use:portal>
	{#each toasts as toast (toast.id)}
		<Toast tone={toast.tone} title={toast.title} message={toast.message} onDismiss={() => onDismiss(toast.id)} />
	{/each}
</div>

<style>
	.gg-toast-stack {
		position: fixed;
		z-index: var(--z-toast);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		pointer-events: none;
		max-height: 100vh;
		overflow: hidden;
	}

	.gg-toast-stack :global(.gg-toast) {
		pointer-events: auto;
	}

	.gg-toast-stack--top-right {
		top: 0;
		right: 0;
		align-items: flex-end;
	}

	.gg-toast-stack--top-center {
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		align-items: center;
	}

	.gg-toast-stack--bottom-right {
		bottom: 0;
		right: 0;
		flex-direction: column-reverse;
		align-items: flex-end;
	}

	.gg-toast-stack--bottom-center {
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		flex-direction: column-reverse;
		align-items: center;
	}
</style>
