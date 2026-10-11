// Lint solo de los ficheros modificados respecto al último commit (nivel de lote).
// Si cambia la configuración de ESLint o de TypeScript, se lintea todo el proyecto.
// Uso: pnpm lint:changed
import { execFileSync, spawnSync } from 'node:child_process';

const FULL_RUN_TRIGGERS = [/^eslint\.config\.js$/, /^tsconfig.*\.json$/];
const LINTED_EXTENSIONS = /\.(ts|js|mjs|cjs|svelte)$/;

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8' })
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

const changed = [
	...git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']),
	...git(['ls-files', '--others', '--exclude-standard'])
];
const unique = [...new Set(changed)];

const configChanged = unique.some((file) => FULL_RUN_TRIGGERS.some((re) => re.test(file)));
const files = unique.filter((file) => LINTED_EXTENSIONS.test(file));

const args = ['eslint', '--max-warnings', '0', '--no-warn-ignored', '--concurrency', 'auto'];

if (configChanged) {
	console.log('Cambia la configuración de ESLint o de TypeScript: lint completo.');
	args.push('.');
} else if (files.length === 0) {
	console.log('Ningún fichero modificado requiere lint.');
	process.exit(0);
} else {
	console.log(`Lint de ${files.length} fichero(s) modificado(s).`);
	args.push(...files);
}

// Con `shell: true` los argumentos se unen en una sola línea de comandos: las rutas de grupo como `(web)` necesitan
// comillas, o la shell las interpreta como sintaxis.
const quoted = ['exec', ...args].map((arg) => (/[\s()]/.test(arg) ? `"${arg}"` : arg));
const result = spawnSync('pnpm', quoted, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
