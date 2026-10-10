// Propiedad de las tablas (ARCHITECTURE.md §4): un repositorio importa solo su propio `schema.ts`. Que `credits` sea
// el único que escribe en las tablas de saldo se comprobará cuando existan esas tablas (L05).
import { describe, expect, it } from 'vitest';
import { featureOf, moduleSpecifiers, sourceFiles } from './source';

describe('propiedad de tablas', () => {
	it('un repositorio no importa el schema.ts de otra funcionalidad', () => {
		const offenders = sourceFiles()
			.filter((f) => /\/repository\.ts$/.test(f.path))
			.flatMap((f) => {
				const own = featureOf(f.path);
				return moduleSpecifiers(f.ast)
					.filter((s) => {
						const match = /\/features\/([^/]+)\/schema(\.ts)?$/.exec(s);
						return match !== null && match[1] !== own;
					})
					.map((s) => `${f.path} → ${s}`);
			});
		expect(offenders).toEqual([]);
	});
});
