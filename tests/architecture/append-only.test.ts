// Tablas solo de añadir (data-model.md; ARCHITECTURE.md §4): ni `update` ni `delete` sobre el historial contable,
// la auditoría, las facturas ni las plantillas de prompts. Los movimientos se corrigen con un movimiento nuevo.
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { sourceFiles } from './source';

const APPEND_ONLY = ['credit_movements', 'admin_audit', 'invoices', 'prompt_templates'];

describe('tablas solo de añadir', () => {
	it('ninguna escritura update o delete apunta a una tabla solo de añadir', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			const visit = (node: ts.Node): void => {
				if (
					ts.isCallExpression(node) &&
					ts.isPropertyAccessExpression(node.expression) &&
					['update', 'delete'].includes(node.expression.name.text)
				) {
					const target = node.expression.expression.getText();
					for (const table of APPEND_ONLY) {
						if (target.includes(table))
							offenders.push(`${file.path}: ${target}.${node.expression.name.text}`);
					}
				}
				ts.forEachChild(node, visit);
			};
			visit(file.ast);
		}
		expect(offenders).toEqual([]);
	});
});
