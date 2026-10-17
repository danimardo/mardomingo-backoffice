// Quién puede borrar datos de una cuenta (BE-FR-07; ARCHITECTURE.md §3, `privacy`; T283–T284): las funciones que anulan el
// saldo, cierran todas las sesiones, anonimizan la cuenta o borran el perfil fiscal y los documentos sincronizados solo las
// llama `privacy`, que las ejecuta juntas en una transacción. Cada dueña puede llamarlas desde sus propios ficheros (para
// cablearlas en su `index.ts`); ninguna otra funcionalidad ni ninguna ruta.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { featureOf, sourceFiles } from './source';

/** Función destructiva → funcionalidad que la define. */
const OWNER: Readonly<Record<string, string>> = Object.freeze({
	forfeitAll: 'credits',
	releaseOpenHolds: 'credits',
	anonymizeUser: 'accounts',
	revokeAllSessions: 'accounts',
	deleteBillingProfile: 'invoicing',
	deleteAllForUser: 'sync'
});

/** Ficheros fuera de `privacy` que sí pueden llamarlas, con el motivo. */
const EXTRA_ALLOWED: ReadonlySet<string> = new Set([]);

function calledName(node: ts.CallExpression): string | undefined {
	const callee = node.expression;
	if (ts.isIdentifier(callee)) return callee.text;
	if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
	return undefined;
}

describe('quién borra datos de una cuenta', () => {
	it('solo privacy y la dueña de cada función llaman a las funciones de borrado', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			if (EXTRA_ALLOWED.has(file.path)) continue;
			const own = featureOf(file.path);
			if (own === 'privacy') continue;
			const visit = (node: ts.Node): void => {
				if (ts.isCallExpression(node)) {
					const name = calledName(node);
					if (name !== undefined && Object.hasOwn(OWNER, name) && OWNER[name] !== own) {
						offenders.push(`${file.path} llama a ${name}()`);
					}
				}
				ts.forEachChild(node, visit);
			};
			visit(file.ast);
		}
		expect(offenders).toEqual([]);
	});

	it('privacy usa de verdad las seis funciones de borrado (el test no es vacío)', () => {
		const used = new Set<string>();
		for (const file of sourceFiles()) {
			if (featureOf(file.path) !== 'privacy') continue;
			const visit = (node: ts.Node): void => {
				if (ts.isCallExpression(node)) {
					const name = calledName(node);
					if (name !== undefined) used.add(name);
				}
				ts.forEachChild(node, visit);
			};
			visit(file.ast);
		}
		for (const name of Object.keys(OWNER)) expect(used.has(name), name).toBe(true);
	});
});
