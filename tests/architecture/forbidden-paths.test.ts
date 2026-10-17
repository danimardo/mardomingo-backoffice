// Rutas y exportaciones prohibidas (ARCHITECTURE.md §2; contracts/web-routes.md 1.9): no hay capas genéricas de
// servicios ni de dominio fuera de las funcionalidades, ni `prerender`, ni `load` en ficheros universales sin justificar.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { sourceFiles } from './source';

const FORBIDDEN_DIRS = ['src/lib/services', 'src/lib/server/domain', 'src/lib/server/services'];

function universalRouteFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) universalRouteFiles(full, found);
		else if (/^\+(page|layout)\.ts$/.test(entry)) found.push(full);
	}
	return found;
}

describe('rutas prohibidas', () => {
	it('no existen capas genéricas de servicios ni de dominio', () => {
		expect(FORBIDDEN_DIRS.filter((dir) => existsSync(dir))).toEqual([]);
	});

	it('no hay +page.ts ni +layout.ts (solo las variantes de servidor, o ninguna)', () => {
		expect(universalRouteFiles('src/routes')).toEqual([]);
	});

	it('ninguna ruta exporta prerender', () => {
		const offenders = sourceFiles()
			.filter((f) => f.path.startsWith('src/routes/'))
			.filter((f) =>
				f.ast.statements.some(
					(s) =>
						ts.isVariableStatement(s) &&
						s.declarationList.declarations.some((d) => d.name.getText() === 'prerender')
				)
			)
			.map((f) => f.path);
		expect(offenders).toEqual([]);
	});
});
