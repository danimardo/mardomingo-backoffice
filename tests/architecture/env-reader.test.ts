// Lectura del entorno (constitución, «Configuración»): solo `src/lib/server/config/env.ts` importa `$env/*` o lee
// `process.env`. Los módulos de logging, el cliente de logs y las herramientas de configuración son la excepción
// documentada en eslint.config.js.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { moduleSpecifiers, sourceFiles } from './source';

const ALLOWED_ENV_FILES = new Set(['src/lib/server/config/env.ts', 'src/lib/logging/client.ts']);

function allowed(path: string): boolean {
	return ALLOWED_ENV_FILES.has(path) || path.startsWith('src/lib/server/logging/');
}

function readsProcessEnv(ast: ts.SourceFile): boolean {
	let found = false;
	const visit = (node: ts.Node): void => {
		if (
			ts.isPropertyAccessExpression(node) &&
			node.name.text === 'env' &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'process'
		) {
			found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(ast);
	return found;
}

describe('lectura del entorno', () => {
	it('solo env.ts importa $env/* y solo los módulos de logging leen process.env', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			if (allowed(file.path)) continue;
			if (moduleSpecifiers(file.ast).some((s) => s.startsWith('$env/')))
				offenders.push(`${file.path}: $env`);
			if (readsProcessEnv(file.ast)) offenders.push(`${file.path}: process.env`);
		}
		expect(offenders).toEqual([]);
	});
});
