// Regenera la documentación pública de la API v1 (`pnpm docs:api`). El OpenAPI sale del código: una prueba de Vitest lo vuelca a una
// carpeta temporal y este script lo copia a `docs/api/` junto al contrato en Markdown. `docs/api/` no se versiona en Secretario:
// allí se enlaza por enlace simbólico.
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = join(root, 'docs', 'api');
const cache = join(root, 'node_modules', '.cache', 'docs-api');

rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
writeFileSync(join(cache, 'request.json'), '{}\n', 'utf8');

// pnpm exporta la ruta de su ejecutable al lanzar un script; así no depende del nombre en Windows.
const pnpm = process.env.npm_execpath ?? 'pnpm';
const runner = /\.(c|m)?js$/.test(pnpm) ? process.execPath : pnpm;
const prefix = runner === process.execPath ? [pnpm] : [];
const run = spawnSync(
	runner,
	[
		...prefix,
		'exec',
		'vitest',
		'run',
		'--project',
		'unit',
		'src/lib/server/api/export-openapi.test.ts'
	],
	{ stdio: 'inherit' }
);
if (run.status !== 0) process.exit(run.status ?? 1);

const generated = join(cache, 'openapi-v1.json');
if (!existsSync(generated)) {
	console.error('La prueba no generó el OpenAPI.');
	process.exit(1);
}
mkdirSync(out, { recursive: true });
copyFileSync(generated, join(out, 'openapi-v1.json'));
// Formato de Prettier, para que dos ejecuciones sobre el mismo código den el mismo fichero (y no haya cambios falsos en Git).
spawnSync(pnpm, ['exec', 'prettier', '--write', join(out, 'openapi-v1.json')], {
	stdio: 'ignore',
	shell: process.platform === 'win32'
});
copyFileSync(
	join(root, 'specs', '001-cuenta-mardomingo-v4', 'contracts', 'api-v1.md'),
	join(out, 'api-v1.md')
);
rmSync(cache, { recursive: true, force: true });
console.log(`Documentación de la API escrita en ${out}`);
