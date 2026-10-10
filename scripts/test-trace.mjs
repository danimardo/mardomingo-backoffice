// Cruza los criterios de aceptación de Historias.md (CA de los BE-FR y criterios UX)
// con las etiquetas de los tests, y lista los que no tienen ninguno.
// Uso: pnpm test:trace [--strict] [BE-FR-71]
// Con --strict devuelve error si queda algún criterio sin test; si no, solo informa.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const filter = args.find((arg) => /^BE-FR-|^UX-/.test(arg));

const historias = readFileSync(join(ROOT, 'Historias.md'), 'utf8').split('\n');

// Criterios: «**BE-FR-71 — …**» seguido de líneas «- CAn: …»
const criteria = new Map();
let currentRequirement = null;
for (const line of historias) {
	const req = line.match(/^\*\*(BE-FR-\d+(?:\.\d+)?)\b/);
	if (req) currentRequirement = req[1];
	const ca = line.match(/^- CA(\d+):/);
	if (ca && currentRequirement) criteria.set(`${currentRequirement}/CA${ca[1]}`, true);
}

// Criterios de experiencia de usuario (sección 16)
const uxStart = historias.findIndex((line) => line.startsWith('## 16.'));
for (const line of historias.slice(uxStart)) {
	for (const ux of line.matchAll(/\b(UX-[A-Z]+|UX-\d{2})\b/g)) criteria.set(ux[1], true);
}

// Etiquetas en tests: [BE-FR-71/CA1], @BE-FR-71, [UX-05], @UX-05, [UX-TEMA/CA1]
const testFiles = [
	...globSync('src/**/*.test.ts', { cwd: ROOT }),
	...globSync('tests/**/*.ts', { cwd: ROOT }),
	...globSync('e2e/**/*.ts', { cwd: ROOT })
];
const covered = new Set();
for (const file of testFiles) {
	const text = readFileSync(join(ROOT, file), 'utf8');
	for (const tag of text.matchAll(
		/\[(BE-FR-\d+(?:\.\d+)?)\/(CA\d+)\]|@(BE-FR-\d+(?:\.\d+)?)|\[(UX-[A-Z]+|UX-\d{2})(?:\/(CA\d+))?\]|@(UX-\d{2})/g
	)) {
		if (tag[1]) covered.add(`${tag[1]}/${tag[2]}`);
		if (tag[3])
			for (const key of criteria.keys()) if (key.startsWith(`${tag[3]}/`)) covered.add(key);
		if (tag[4]) covered.add(tag[5] ? `${tag[4]}` : tag[4]);
		if (tag[6]) covered.add(tag[6]);
	}
}

const all = [...criteria.keys()].filter((key) => !filter || key.startsWith(filter));
const missing = all.filter((key) => !covered.has(key));

console.log(
	`Criterios: ${all.length}. Con test: ${all.length - missing.length}. Sin test: ${missing.length}.`
);
for (const key of missing) console.log(`  sin test: ${key}`);

process.exit(strict && missing.length > 0 ? 1 : 0);
