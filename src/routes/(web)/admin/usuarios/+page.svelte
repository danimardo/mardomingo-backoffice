<script lang="ts">
	// W34 · `/admin/usuarios`: búsqueda de cuentas por email o id, con paginación (T306; BE-FR-50). Filtro GET; sin JavaScript funciona igual.
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function stateOf(row: { banned: boolean; deleted: boolean }): string {
		if (row.deleted) return m.admin_users_state_deleted();
		return row.banned ? m.admin_users_state_blocked() : m.admin_users_state_active();
	}
</script>

<svelte:head>
	<title>{m.admin_users_title()}</title>
</svelte:head>

<h1>{m.admin_users_title()}</h1>
<p>{m.admin_users_intro()}</p>

<form id="busqueda-form" method="GET" action={resolve('/admin/usuarios')}>
	<TextField id="busqueda" name="q" label={m.admin_users_search_label()} value={data.q} />
	<p><Button type="submit" variant="primary">{m.admin_users_search_submit()}</Button></p>
</form>

{#if data.rows.length === 0}
	<p>{m.admin_users_empty()}</p>
{:else}
	<ul>
		{#each data.rows as row (row.id)}
			<li>
				<a href={resolve(`/admin/usuarios/${row.id}`)}>{row.email}</a>
				· {row.role} · {stateOf(row)}
			</li>
		{/each}
	</ul>
	<nav aria-label={m.admin_users_title()}>
		{#if data.pagination.hasPrevious}
			<button
				type="submit"
				form="busqueda-form"
				name="pagina"
				value={String(data.pagination.page - 1)}
			>
				{m.admin_users_previous()}
			</button>
		{/if}
		<span>{m.admin_users_page({ page: String(data.pagination.page) })}</span>
		{#if data.pagination.hasNext}
			<button
				type="submit"
				form="busqueda-form"
				name="pagina"
				value={String(data.pagination.page + 1)}
			>
				{m.admin_users_next()}
			</button>
		{/if}
	</nav>
{/if}

<style>
	/* Emails largos sin espacios: se parten para no desbordar el ancho del móvil (UX-13, T357). */
	li {
		overflow-wrap: anywhere;
	}
</style>
