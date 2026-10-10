// Estado de módulo (constitución, «Estado de módulo»): en código que se ejecuta en el servidor, ni `let` ni
// colecciones sin congelar a nivel de módulo. Excepciones: `*.cache.ts` (cachés deliberadas), `hooks.client.ts`
// (solo navegador) y los `export const` de rutas que SvelteKit exige (`actions`).
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { sourceFiles } from './source';

const EXEMPT_FILES = new Set(['src/hooks.client.ts']);
const EXEMPT_EXPORTS = new Set(['actions']);

function unwrap(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isParenthesizedExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

function isFrozen(expression: ts.Expression): boolean {
	const value = unwrap(expression);
	return (
		ts.isCallExpression(value) &&
		ts.isPropertyAccessExpression(value.expression) &&
		value.expression.expression.getText() === 'Object' &&
		value.expression.name.text === 'freeze'
	);
}

function isCollection(expression: ts.Expression): boolean {
	const value = unwrap(expression);
	if (ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)) return true;
	return ts.isNewExpression(value) && ['Map', 'Set'].includes(value.expression.getText());
}

interface Finding {
	readonly path: string;
	readonly name: string;
	readonly reason: string;
}

function findings(): Finding[] {
	const result: Finding[] = [];
	for (const file of sourceFiles()) {
		if (file.path.endsWith('.svelte') || EXEMPT_FILES.has(file.path)) continue;
		if (file.path.endsWith('.cache.ts')) continue;
		const isRouteModule = file.path.startsWith('src/routes/');
		for (const statement of file.ast.statements) {
			if (!ts.isVariableStatement(statement)) continue;
			const exported =
				statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
			for (const declaration of statement.declarationList.declarations) {
				const name = declaration.name.getText();
				if (isRouteModule && exported && EXEMPT_EXPORTS.has(name)) continue;
				if ((statement.declarationList.flags & ts.NodeFlags.Let) !== 0) {
					result.push({ path: file.path, name, reason: 'let a nivel de módulo' });
					continue;
				}
				const init = declaration.initializer;
				if (init !== undefined && isCollection(init) && !isFrozen(init)) {
					result.push({ path: file.path, name, reason: 'colección sin Object.freeze' });
				}
			}
		}
	}
	return result;
}

describe('estado de módulo en código del servidor', () => {
	it('no hay let ni colecciones sin congelar a nivel de módulo fuera de *.cache.ts', () => {
		expect(findings().map((f) => `${f.path}: ${f.name} (${f.reason})`)).toEqual([]);
	});
});
