<script lang="ts">
	// Paginación de las listas (DS-06; T255). Enlaces GET que conservan los filtros (`hrefFor` los compone); la página actual
	// lleva `aria-current="page"` y se anuncia como texto, no solo por color.
	import * as m from '$lib/paraglide/messages.js';

	let {
		current,
		total,
		hrefFor
	}: { current: number; total: number; hrefFor: (page: number) => string } = $props();
	const pages = $derived(Array.from({ length: Math.max(total, 1) }, (_, index) => index + 1));
</script>

{#if total > 1}
	<nav aria-label={m.pagination_label()}>
		<ul class="pages">
			{#if current > 1}
				{@const previous = hrefFor(current - 1)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- la ruta la compone el llamador con resolve(), como Button -->
				<li><a href={previous}>{m.pagination_previous()}</a></li>
			{/if}
			{#each pages as page (page)}
				<li>
					{@const href = hrefFor(page)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- la ruta la compone el llamador con resolve(), como Button -->
					<a {href} aria-current={page === current ? 'page' : undefined}>
						{m.pagination_page({ page: String(page) })}
					</a>
				</li>
			{/each}
			{#if current < total}
				{@const next = hrefFor(current + 1)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- la ruta la compone el llamador con resolve(), como Button -->
				<li><a href={next}>{m.pagination_next()}</a></li>
			{/if}
		</ul>
	</nav>
{/if}

<style>
	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
	}
	.pages a {
		display: inline-block;
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		text-align: center;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
	}
	.pages a[aria-current='page'] {
		font-weight: var(--font-weight-control);
		border-color: var(--border-accent-strong);
	}
</style>
