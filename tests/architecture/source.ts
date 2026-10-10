// Lectura del código fuente para los tests de arquitectura (T-ARCH-001; R08). Los imports se leen con la API de
// TypeScript, no con expresiones regulares. En los `.svelte` solo se extrae el bloque `<script>` antes de parsear.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

export interface SourceFile {
	/** Ruta relativa a la raíz del repositorio, con `/`. */
	readonly path: string;
	readonly ast: ts.SourceFile;
}

const SRC_ROOT = 'src';
const SCRIPT_BLOCK = /<script[^>]*>([\s\S]*?)<\/script>/g;

function walk(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'paraglide') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, found);
		else found.push(full);
	}
	return found;
}

function parse(path: string, text: string): ts.SourceFile {
	return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Todos los módulos de `src/` que se ejecutan (TypeScript, `.svelte.ts` y el script de los `.svelte`). Sin los tests. */
export function sourceFiles(): SourceFile[] {
	return walk(SRC_ROOT)
		.filter((file) => /\.(ts|svelte)$/.test(file) && !/\.test\.ts$/.test(file))
		.map((file) => {
			const path = relative('.', file).split(sep).join('/');
			const text = readFileSync(file, 'utf8');
			if (file.endsWith('.svelte')) {
				const scripts = [...text.matchAll(SCRIPT_BLOCK)].map((match) => match[1] ?? '');
				return { path, ast: parse(path, scripts.join('\n')) };
			}
			return { path, ast: parse(path, text) };
		});
}

/** Especificadores de módulo de imports, re-exports e `import()` dinámicos. */
export function moduleSpecifiers(ast: ts.SourceFile): string[] {
	const specifiers: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const specifier = node.moduleSpecifier;
			if (specifier !== undefined && ts.isStringLiteral(specifier)) specifiers.push(specifier.text);
		} else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			const [first] = node.arguments;
			if (first !== undefined && ts.isStringLiteral(first)) specifiers.push(first.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(ast);
	return specifiers;
}

/** Ruta de la funcionalidad (`src/lib/server/features/<nombre>`) a la que pertenece un fichero, si pertenece. */
export function featureOf(path: string): string | undefined {
	const match = /^src\/lib\/server\/features\/([^/]+)\//.exec(path);
	return match?.[1];
}
