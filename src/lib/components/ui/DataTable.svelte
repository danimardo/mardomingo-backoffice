<script lang="ts">
	// Estados: orden activo anunciado con `aria-sort`; sin filas, el llamador muestra `EmptyState`. Teclado: los encabezados de
	// orden son enlaces GET enfocables y el contenedor con desplazamiento también. Temas: colores de tokens en claro y oscuro.
	// Efectos reducidos: sin transiciones ni cristal propios.
	// Tabla de datos del panel (DS-06; T255). Encabezados `th scope="col"` con `aria-sort`; el orden es un enlace GET (sin
	// JavaScript). En pantallas estrechas la tabla se desplaza dentro de su contenedor, que es enfocable y tiene nombre.
	interface Column {
		readonly key: string;
		readonly label: string;
		readonly align?: 'start' | 'end';
		readonly sortHref?: string;
		readonly sort?: 'ascending' | 'descending' | 'none';
	}

	let {
		caption,
		columns,
		rows
	}: {
		caption: string;
		columns: readonly Column[];
		rows: readonly (readonly string[])[];
	} = $props();
</script>

<!-- Un contenedor desplazable debe poder enfocarse para recorrerlo con teclado (WCAG 2.1.1). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="scroll" role="region" aria-label={caption} tabindex="0">
	<table>
		<caption>{caption}</caption>
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th
						scope="col"
						class={column.align === 'end' ? 'num' : undefined}
						aria-sort={column.sort ?? undefined}
					>
						{#if column.sortHref}
							{@const href = column.sortHref}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- el llamador pasa la ruta ya resuelta, como Button -->
							<a {href}>{column.label}</a>
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (index)}
				<tr>
					{#each row as cell, cellIndex (cellIndex)}
						<td class={columns[cellIndex]?.align === 'end' ? 'num' : undefined}>{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--border-subtle);
		border-radius: 0.5rem;
	}
	.scroll:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	caption {
		text-align: start;
		padding: 0.5rem 0.75rem;
		color: var(--color-text-secondary);
	}
	th,
	td {
		padding: 0.5rem 0.75rem;
		text-align: start;
		border-top: 1px solid var(--border-subtle);
	}
	.num {
		text-align: end;
	}
</style>
