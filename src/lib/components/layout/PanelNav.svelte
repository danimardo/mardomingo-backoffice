<script lang="ts">
	// Navegación del panel (T259; 16.5). El enlace de la página actual lleva `aria-current="page"` y se anuncia como texto.
	import { page } from '$app/state';

	interface Link {
		readonly href: string;
		readonly label: string;
	}

	let { links, label }: { links: readonly Link[]; label: string } = $props();
</script>

<nav aria-label={label}>
	<ul class="panel-nav">
		{#each links as link (link.href)}
			<li>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- los enlaces llegan ya resueltos desde el layout, como Button -->
				<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}
					>{link.label}</a
				>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.panel-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
	}
	.panel-nav a {
		display: inline-block;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
	}
	.panel-nav a[aria-current='page'] {
		font-weight: var(--font-weight-control);
		border: 1px solid var(--border-accent-strong);
	}
</style>
