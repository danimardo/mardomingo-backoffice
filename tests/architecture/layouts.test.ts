// Layouts (contracts/web-routes.md 1.9): `+layout.server.ts` no valida con `z.strictObject` (un layout no debe
// rechazar claves de sus hijos) y los datos del layout raíz son el único punto de carga compartida.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { sourceFiles } from './source';

function usesStrictObject(ast: ts.SourceFile): boolean {
	const calls: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isPropertyAccessExpression(node) && node.name.text === 'strictObject')
			calls.push(node.getText());
		ts.forEachChild(node, visit);
	};
	visit(ast);
	return calls.length > 0;
}

describe('layouts', () => {
	it('ningún +layout.server.ts usa z.strictObject', () => {
		const offenders = sourceFiles()
			.filter((f) => /\/\+layout\.server\.ts$/.test(f.path))
			.filter((f) => usesStrictObject(f.ast))
			.map((f) => f.path);
		expect(offenders).toEqual([]);
	});
});
