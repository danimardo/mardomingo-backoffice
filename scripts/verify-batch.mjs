// Puerta de cierre de lote: nivel 2 ampliado (Historias 15.24). PROPUESTA pendiente de aprobación.
// Secuencial y con parada en el primer fallo, para que un error barato (formato, arquitectura, umbral de dominio) no cueste
// el ciclo completo de `validate`. No sustituye a `validate`: PR, release y cambios transversales siguen pasando por él.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const LOG_DIR = '.local/verification';
const LOG = `${LOG_DIR}/runs.jsonl`;
const PRETTIER_FILES = /\.(ts|svelte|js|mjs|json|css|md|yml|yaml)$/;
// Cambios que propagan el impacto más allá de los tests relacionados (15.24, «Se amplía la selección»).
const WIDE = [
	/^src\/lib\/shared\//,
	/^src\/lib\/server\/shared\//,
	/^src\/lib\/server\/features\/[^/]+\/index\.ts$/,
	/^src\/lib\/server\/composition\.ts$/,
	/^src\/hooks\.server\.ts$/,
	/^drizzle\//,
	/^(package\.json|pnpm-lock\.yaml|vite\.config\.ts|tsconfig\.json)$/
];
// Cambios que este nivel NO comprueba: piden build, HTTP y E2E (nivel 3).
const NEEDS_LEVEL_3 = [/^src\/routes\//, /^src\/hooks\.server\.ts$/, /^e2e\//, /^tests\/http\//];

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8' })
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

const head = git(['rev-parse', 'HEAD'])[0] ?? 'desconocido';
const changed = [
	...new Set([
		...git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']),
		...git(['ls-files', '--others', '--exclude-standard'])
	])
];

if (changed.length === 0) {
	console.log('Sin cambios respecto a HEAD: no hay nada que verificar en este nivel.');
	process.exit(0);
}

const id = randomUUID();
const steps = [];
const quote = (arg) => (/[\s()]/.test(arg) ? `"${arg}"` : arg);

function record(result, extra = {}) {
	mkdirSync(LOG_DIR, { recursive: true });
	// Se escribe EN_CURSO al empezar y se cierra al acabar: una sesión cortada no se confunde con un éxito.
	appendFileSync(
		LOG,
		JSON.stringify({
			id,
			fecha: new Date().toISOString(),
			base: head,
			cambios: changed.length,
			resultado: result,
			pasos: steps,
			...extra
		}) + '\n'
	);
}

function finish(code, result) {
	record(result);
	process.exit(code);
}

function step(name, args, { capture = false } = {}) {
	const started = Date.now();
	const run = spawnSync('pnpm', args.map(quote), {
		shell: true,
		encoding: 'utf8',
		stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit'
	});
	const secs = Number(((Date.now() - started) / 1000).toFixed(1));
	if (capture) {
		process.stdout.write(run.stdout ?? '');
		process.stderr.write(run.stderr ?? '');
	}
	const status = run.status ?? 1;
	steps.push({ nombre: name, segundos: secs, estado: status === 0 ? 'PASA' : 'FALLA' });
	console.log(`[${status === 0 ? 'OK' : 'FALLA'}] ${name}: ${secs} s`);
	if (status !== 0) finish(status, 'FALLA');
	return `${run.stdout ?? ''}${run.stderr ?? ''}`;
}

record('EN_CURSO');

const forPrettier = changed.filter((file) => PRETTIER_FILES.test(file) && existsSync(file));
if (forPrettier.length > 0)
	step('prettier de lo modificado', ['exec', 'prettier', '--check', ...forPrettier]);
step('lint:changed', ['lint:changed']);
step('check', ['check']);
const wide = changed.some((file) => WIDE.some((pattern) => pattern.test(file)));
if (wide) {
	console.log('Cambio transversal: se ejecutan unit, componente e integración completos.');
	// `pnpm test` ya incluye el test de arquitectura (proyecto unit): no se repite aparte.
	step('tests (alcance ampliado)', ['test']);
} else {
	// `vitest --changed` no selecciona el test de arquitectura (no importa el código que comprueba): se ejecuta siempre.
	step('test de arquitectura', [
		'exec',
		'vitest',
		'run',
		'--project',
		'unit',
		'tests/architecture'
	]);
	const out = step(
		'tests relacionados con lo modificado',
		[
			'exec',
			'vitest',
			'run',
			'--changed',
			'HEAD',
			'--project',
			'unit',
			'--project',
			'component',
			'--project',
			'integration',
			'--passWithNoTests'
		],
		{ capture: true }
	);
	if (/No test files found/.test(out) && changed.some((file) => /^src\//.test(file))) {
		// Cero tests no es éxito: hay código de src modificado y ningún test lo alcanzó.
		console.warn(
			'AVISO: ningún test relacionado con el código modificado. Revisa si se esperaba alguno.'
		);
		steps.push({
			nombre: 'aviso: selección vacía con código modificado',
			segundos: 0,
			estado: 'DESCONOCIDO'
		});
	}
}

// Umbral del 100 % del dominio, solo de los dominios tocados (se ve en minutos con `test:coverage`, aquí en segundos).
const domains = new Set(
	changed
		.map((file) => /^(src\/lib\/server\/features\/[^/]+)\/domain\//.exec(file)?.[1])
		.filter(Boolean)
);
for (const feature of domains) {
	step(`cobertura del dominio de ${feature.split('/').pop()}`, [
		'exec',
		'vitest',
		'run',
		'--project',
		'unit',
		'--coverage',
		`--coverage.include=${feature}/domain/**`,
		feature
	]);
}

const level3 = changed.filter((file) => NEEDS_LEVEL_3.some((pattern) => pattern.test(file)));
if (level3.length > 0) {
	console.log(
		`PENDIENTE (nivel 3): ${level3.length} fichero(s) de rutas, hooks, E2E o HTTP. No se han ejecutado build, test:http ni E2E.`
	);
}
console.log(
	'Nivel 2 ampliado superado. No equivale a `validate`: PR, release y cambios transversales requieren la puerta completa.'
);
finish(0, 'PASA');
