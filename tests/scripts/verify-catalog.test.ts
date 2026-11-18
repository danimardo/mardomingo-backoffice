// Pruebas de `scripts/verify-catalog.mjs` (T453; ADR 0009): el catálogo del sistema de diseño no se importa y
// `ACTIVOS.md` coincide con lo promovido a components/ui y layout. Cada caso monta un repositorio mínimo en una carpeta
// temporal y ejecuta el script con `--root`, como lo ejecutaría el CI.
//
// Los fixtures escriben la carpeta del catálogo con `${CAT}` y los globs con `${GLOB}`: así el texto de este fichero no
// contiene ningún import real del catálogo y el propio script, al revisar `tests/`, no lo confunde con uno.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', '..', 'scripts', 'verify-catalog.mjs');
const CAT = ['design', 'catalog'].join('-');
const GLOB = 'import.meta.glob';

const EMPTY_TABLE = `| Componente del catálogo | Destino | Fecha | Motivo |
| --- | --- | --- | --- |
`;

function activos(rows: string[] = []): string {
	return `# Componentes activos\n\n${EMPTY_TABLE}${rows.join('\n')}\n\n## Reglas\n\nTexto.\n`;
}

/** Repositorio mínimo: un componente en el catálogo (que importa sus tokens), una página y `ACTIVOS.md`. */
function baseFiles(): Record<string, string> {
	return {
		[`src/lib/${CAT}/buttons/Button.svelte`]: `<script lang="ts">\n\timport '../tokens/tokens.css';\n</script>\n<button>Botón</button>\n`,
		[`src/lib/${CAT}/core/focusTrap.ts`]: `import { x } from '../tokens/x';\nexport const trap = x;\n`,
		[`src/lib/${CAT}/ACTIVOS.md`]: activos(),
		'src/routes/+page.svelte': `<script lang="ts">\n\timport Button from '$lib/components/ui/Button.svelte';\n</script>\n<Button />\n`,
		'src/lib/components/ui/Button.svelte': '<button><slot /></button>\n',
		'src/app.css': `@import 'tailwindcss';\n@source not './lib/${CAT}';\n`
	};
}

/** Copia de los ficheros sin `path`. */
function without(files: Record<string, string>, path: string): Record<string, string> {
	return Object.fromEntries(Object.entries(files).filter(([key]) => key !== path));
}

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(files: Record<string, string>): { status: number | null; output: string } {
	const root = mkdtempSync(join(tmpdir(), 'verify-catalog-'));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		const full = join(root, ...path.split('/'));
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, content, 'utf8');
	}
	const result = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
	return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const PROMOTED_ROW = `| buttons/Button.svelte | src/lib/components/ui/Button.svelte | 2026-11-18 | Botón de la portada |`;
const PROMOTED_BUTTON = `<!-- @promovido-de buttons/Button.svelte -->\n<button><slot /></button>\n`;

describe('verify-catalog: el catálogo no se importa (a)', () => {
	it('pasa con el catálogo aislado y la lista vacía; las importaciones internas del catálogo no cuentan', () => {
		const { status, output } = run(baseFiles());
		expect(output).toContain('Catálogo aislado');
		expect(status).toBe(0);
	});

	it('falla si una ruta importa del catálogo con $lib, con fichero, línea y la regla', () => {
		const { status, output } = run({
			...baseFiles(),
			'src/routes/+page.svelte': `<script lang="ts">\n\timport Button from '$lib/${CAT}/buttons/Button.svelte';\n</script>\n`
		});
		expect(status).toBe(1);
		expect(output).toContain('src/routes/+page.svelte:2 importa');
		expect(output).toContain('El catálogo no se importa');
	});

	it('falla con una ruta relativa desde components/ui', () => {
		const { status, output } = run({
			...baseFiles(),
			'src/lib/components/ui/Card.svelte': `<script lang="ts">\n\timport { trap } from '../../${CAT}/core/focusTrap';\n</script>\n`
		});
		expect(status).toBe(1);
		expect(output).toContain('src/lib/components/ui/Card.svelte:2');
	});

	it('falla con un import dinámico desde e2e/ y un vi.mock desde tests/', () => {
		const { status, output } = run({
			...baseFiles(),
			'e2e/portada.spec.ts': `const m = await import('../src/lib/${CAT}/buttons/Button.svelte');\n`,
			'tests/http/x.test.ts': `vi.mock('$lib/${CAT}/core/focusTrap');\n`
		});
		expect(status).toBe(1);
		expect(output).toContain('e2e/portada.spec.ts:1');
		expect(output).toContain('tests/http/x.test.ts:1');
	});

	it('falla con un import.meta.glob que abarca el catálogo, pero no con uno que no lo abarca', () => {
		const wide = run({
			...baseFiles(),
			'src/lib/registry.ts': `export const all = ${GLOB}('$lib/**/*.svelte');\n`
		});
		expect(wide.status).toBe(1);
		expect(wide.output).toContain('src/lib/registry.ts:1');

		const narrow = run({
			...baseFiles(),
			'src/lib/registry.ts': `export const ui = ${GLOB}('$lib/components/**/*.svelte');\n`
		});
		expect(narrow.status).toBe(0);
	});

	it('falla si un CSS trae el catálogo como fuente de Tailwind (@source sin «not»)', () => {
		const { status, output } = run({
			...baseFiles(),
			'src/app.css': `@import 'tailwindcss';\n@source './lib/${CAT}';\n`
		});
		expect(status).toBe(1);
		expect(output).toContain('src/app.css:2');
	});
});

describe('verify-catalog: ACTIVOS.md y los componentes promovidos (b, c, d)', () => {
	it('pasa con un componente promovido que existe en el catálogo y en su destino y declara su origen', () => {
		const { status, output } = run({
			...baseFiles(),
			[`src/lib/${CAT}/ACTIVOS.md`]: activos([PROMOTED_ROW]),
			'src/lib/components/ui/Button.svelte': PROMOTED_BUTTON
		});
		expect(output).toContain('1 componente(s) promovido(s)');
		expect(status).toBe(0);
	});

	it('acepta la ruta del catálogo completa en @promovido-de y en la tabla, y la cabecera de un .ts', () => {
		const { status } = run({
			...baseFiles(),
			[`src/lib/${CAT}/ACTIVOS.md`]: activos([
				`| \`src/lib/${CAT}/core/focusTrap.ts\` | \`src/lib/components/layout/focusTrap.ts\` | 2026-11-18 | Diálogo |`
			]),
			'src/lib/components/layout/focusTrap.ts': `// @promovido-de src/lib/${CAT}/core/focusTrap.ts\nexport const trap = 1;\n`
		});
		expect(status).toBe(0);
	});

	it('falla si falta ACTIVOS.md', () => {
		const { status, output } = run(without(baseFiles(), `src/lib/${CAT}/ACTIVOS.md`));
		expect(status).toBe(1);
		expect(output).toContain('ACTIVOS.md: es la lista de componentes promovidos');
	});

	it('falla si un componente de la lista no existe en su destino (b)', () => {
		const { status, output } = run({
			...without(baseFiles(), 'src/lib/components/ui/Button.svelte'),
			[`src/lib/${CAT}/ACTIVOS.md`]: activos([PROMOTED_ROW])
		});
		expect(status).toBe(1);
		expect(output).toContain(
			'el componente promovido «buttons/Button.svelte» no existe en su destino «src/lib/components/ui/Button.svelte»'
		);
	});

	it('falla si un componente de la lista no existe en el catálogo, si el destino no es ui ni layout o si la fila está mal', () => {
		const { status, output } = run({
			...baseFiles(),
			[`src/lib/${CAT}/ACTIVOS.md`]: activos([
				'| buttons/Fantasma.svelte | src/lib/components/ui/Button.svelte | 2026-11-18 | Prueba |',
				'| core/focusTrap.ts | src/routes/focusTrap.ts | 2026-11-18 | Prueba |',
				'| buttons/Button.svelte | src/lib/components/ui/Button.svelte | ayer | |'
			]),
			'src/lib/components/ui/Button.svelte': PROMOTED_BUTTON
		});
		expect(status).toBe(1);
		expect(output).toContain('«buttons/Fantasma.svelte» no existe en el catálogo');
		expect(output).toContain('el destino «src/routes/focusTrap.ts» no está en');
		expect(output).toContain('fila mal formada');
	});

	it('falla si el destino de la lista no declara @promovido-de con su ruta (d)', () => {
		const { status, output } = run({
			...baseFiles(),
			[`src/lib/${CAT}/ACTIVOS.md`]: activos([PROMOTED_ROW])
		});
		expect(status).toBe(1);
		expect(output).toContain(
			'src/lib/components/ui/Button.svelte: le falta en la cabecera «@promovido-de buttons/Button.svelte»'
		);
	});

	it('falla si un componente declara @promovido-de con una ruta que no figura en la lista (c)', () => {
		const { status, output } = run({
			...baseFiles(),
			'src/lib/components/ui/Button.svelte': PROMOTED_BUTTON
		});
		expect(status).toBe(1);
		expect(output).toContain('declara «@promovido-de buttons/Button.svelte», que no figura en');
	});

	it('falla si un componente declara @promovido-de con una ruta que no existe en el catálogo (c)', () => {
		const { status, output } = run({
			...baseFiles(),
			'src/lib/components/layout/Shell.svelte':
				'<!-- @promovido-de layout/Shell.svelte -->\n<div></div>\n'
		});
		expect(status).toBe(1);
		expect(output).toContain(
			'declara «@promovido-de layout/Shell.svelte», que no existe en el catálogo'
		);
	});
});
