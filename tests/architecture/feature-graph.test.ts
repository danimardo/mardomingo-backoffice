// Grafo de funcionalidades (ARCHITECTURE.md §3–§4; D-03): entre funcionalidades solo se importa `index.ts` (o la
// carpeta, que resuelve a su `index.ts`), y el grafo no tiene ciclos. `audit`, `shared` y los módulos compartidos no
// importan funcionalidades. El orden de las funcionalidades se comprobará al crear la primera (L02), cuando exista.
import { describe, expect, it } from 'vitest';
import { featureOf, moduleSpecifiers, sourceFiles } from './source';

const FEATURE_IMPORT = /^\$lib\/server\/features\/([^/]+)(\/index)?$/;
const FEATURE_DEEP = /^\$lib\/server\/features\/([^/]+)\/(.+)$/;

interface Edge {
	readonly from: string;
	readonly to: string;
	readonly path: string;
}

function edges(): Edge[] {
	const result: Edge[] = [];
	for (const file of sourceFiles()) {
		const from = featureOf(file.path);
		for (const specifier of moduleSpecifiers(file.ast)) {
			const deep = FEATURE_DEEP.exec(specifier);
			// D-03: un schema.ts puede referenciar el schema.ts de otra funcionalidad solo para references(); no cuenta en el grafo.
			const referenceOnly = file.path.endsWith('/schema.ts') && /\/schema$/.test(specifier);
			if (referenceOnly) continue;
			if (deep !== null && deep[1] !== from && !FEATURE_IMPORT.test(specifier)) {
				result.push({
					from: from ?? '(fuera)',
					to: deep[1] ?? '',
					path: `${file.path} → ${specifier}`
				});
			}
			const shallow = FEATURE_IMPORT.exec(specifier);
			if (shallow !== null && shallow[1] !== from && from !== undefined) {
				result.push({ from, to: shallow[1] ?? '', path: file.path });
			}
		}
	}
	return result;
}

function hasCycle(pairs: readonly Edge[]): boolean {
	const graph = new Map<string, Set<string>>();
	for (const edge of pairs) {
		const next = graph.get(edge.from) ?? new Set<string>();
		next.add(edge.to);
		graph.set(edge.from, next);
	}
	const state = new Map<string, 'visiting' | 'done'>();
	const visit = (node: string): boolean => {
		if (state.get(node) === 'visiting') return true;
		if (state.get(node) === 'done') return false;
		state.set(node, 'visiting');
		for (const next of graph.get(node) ?? []) {
			if (visit(next)) return true;
		}
		state.set(node, 'done');
		return false;
	};
	return [...graph.keys()].some((node) => visit(node));
}

describe('grafo de funcionalidades', () => {
	it('entre funcionalidades solo se importa index.ts', () => {
		// Incluye las rutas: también desde fuera de una funcionalidad solo se importa su index.ts.
		const deep = edges().filter((e) => e.path.includes(' → '));
		expect(deep.map((e) => e.path)).toEqual([]);
	});

	it('el grafo de funcionalidades no tiene ciclos', () => {
		expect(hasCycle(edges())).toBe(false);
	});

	it('audit, shared y los compartidos no importan funcionalidades', () => {
		const offenders = sourceFiles()
			.filter((f) => /^src\/lib\/(shared|server\/shared|server\/features\/audit)\//.test(f.path))
			.flatMap((f) =>
				moduleSpecifiers(f.ast)
					.filter((s) => s.startsWith('$lib/server/features/'))
					.map((s) => `${f.path} → ${s}`)
			);
		expect(offenders).toEqual([]);
	});
});
