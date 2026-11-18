// Catálogo del sistema de diseño (ADR 0009; constitución, principio XIII; T453). El catálogo de
// `src/lib/design-catalog/` está copiado sin adaptar y fuera de todas las comprobaciones; solo se comprueba lo que se usa,
// y lo que se usa se promueve antes a `src/lib/components/ui/` o `layout/`. Este script falla si:
//   a) algún fichero de `src/`, `e2e/` o `tests/` (fuera del catálogo) importa algo del catálogo;
//   b) algún componente de `ACTIVOS.md` no existe en su destino, no existe en el catálogo, o su fila está mal formada;
//   c) un fichero de `components/ui|layout` declara `@promovido-de <ruta>` y esa ruta no figura en `ACTIVOS.md` (con ese
//      destino) o no existe en el catálogo;
//   d) un componente de `ACTIVOS.md` no declara en su destino `@promovido-de` con su ruta del catálogo.
// Uso: pnpm verify:catalog [--root <directorio>]   (`--root` solo para las pruebas del propio script)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, resolve, sep } from 'node:path';

const CATALOG = 'src/lib/design-catalog';
const ACTIVOS = `${CATALOG}/ACTIVOS.md`;
const PROMOTION_DIRS = ['src/lib/components/ui', 'src/lib/components/layout'];
const SCANNED_ROOTS = ['src', 'e2e', 'tests'];
// Código generado, dependencias y temporales de las pruebas: no son código del repositorio.
const SKIPPED_DIRS = new Set(['node_modules', 'paraglide', '.tmp']);
const CODE = /\.(?:ts|js|mjs|cjs|svelte|css)$/;
const TABLE_HEADER = /\|\s*Componente del catálogo\s*\|/;
const PROMOTED_FROM = /@promovido-de\s+`?([^\s`]+)`?/;
const HEADER_LINES = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Especificadores de módulo: import/export … from, import '…', import(), require(), import.meta.glob, vi.mock y las
// directivas de CSS que traen ficheros (@import, @source, @reference, @plugin). `@source not` no trae nada y no casa.
const SPECIFIER_PATTERNS = [
	/\b(?:from|import)\s*['"]([^'"\n]+)['"]/g,
	/\b(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]/g,
	/\b(?:glob|mock|doMock|importActual|importMock)\s*\(\s*\[?\s*['"]([^'"\n]+)['"]/g,
	/@(?:import|source|reference|plugin)\s+(?:url\(\s*)?['"]([^'"\n]+)['"]/g
];

const rootArg = process.argv.indexOf('--root');
const ROOT =
	rootArg === -1 ? join(import.meta.dirname, '..') : resolve(process.argv[rootArg + 1] ?? '.');

const toPosix = (path) => path.split(sep).join('/');
const abs = (path) => join(ROOT, ...path.split('/'));

/** Ficheros bajo `dir` (ruta relativa a la raíz, con `/`), sin las carpetas omitidas ni `except`. */
function walk(dir, except, found = []) {
	if (!existsSync(abs(dir))) return found;
	for (const entry of readdirSync(abs(dir))) {
		const path = `${dir}/${entry}`;
		if (path === except || SKIPPED_DIRS.has(entry)) continue;
		if (statSync(abs(path)).isDirectory()) walk(path, except, found);
		else found.push(path);
	}
	return found;
}

/** Quita el prefijo del catálogo para comparar rutas: `src/lib/design-catalog/x`, `$lib/design-catalog/x` → `x`. */
function catalogRelative(path) {
	return path.replace(/^\.?\/?(?:src\/lib|\$lib)\/design-catalog\//, '');
}

function inCatalog(target) {
	return target === CATALOG || target.startsWith(`${CATALOG}/`);
}

/** ¿El especificador, escrito en `fromFile`, apunta al catálogo (o lo abarca con un glob)? */
function pointsToCatalog(specifier, fromFile) {
	const clean = specifier.split('?')[0] ?? '';
	let target;
	if (clean === '$lib' || clean.startsWith('$lib/')) target = `src/lib${clean.slice(4)}`;
	else if (clean.startsWith('.'))
		target = posix.normalize(posix.join(posix.dirname(fromFile), clean));
	else return clean.includes('design-catalog');
	if (inCatalog(target)) return true;
	// Un glob (`import.meta.glob('$lib/**/*.svelte')`) que abarca la carpeta del catálogo también la importa.
	const staticPart = target.split(/[*{[]/)[0] ?? '';
	return staticPart !== target && CATALOG.startsWith(staticPart.replace(/\/$/, ''));
}

function lineOf(text, index) {
	return text.slice(0, index).split('\n').length;
}

// a) Nadie importa el catálogo.
function findCatalogImports() {
	const errors = [];
	const files = SCANNED_ROOTS.flatMap((dir) => walk(dir, CATALOG)).filter((f) => CODE.test(f));
	for (const file of files) {
		const text = readFileSync(abs(file), 'utf8');
		for (const pattern of SPECIFIER_PATTERNS) {
			for (const match of text.matchAll(pattern)) {
				const specifier = match[1] ?? '';
				if (pointsToCatalog(specifier, file)) {
					errors.push(
						`${file}:${lineOf(text, match.index ?? 0)} importa «${specifier}», que es del catálogo. El catálogo no se ` +
							`importa: promueve el componente a src/lib/components/ui o layout y añádelo a ${ACTIVOS}.`
					);
				}
			}
		}
	}
	return { errors, scanned: files.length };
}

/** Filas de la tabla de activos: { line, origin, destination, date, reason }. */
function readActivos(errors) {
	if (!existsSync(abs(ACTIVOS))) {
		errors.push(`Falta ${ACTIVOS}: es la lista de componentes promovidos del catálogo (ADR 0009).`);
		return [];
	}
	const lines = readFileSync(abs(ACTIVOS), 'utf8').split(/\r?\n/);
	const start = lines.findIndex((line) => TABLE_HEADER.test(line));
	if (start === -1) {
		errors.push(
			`${ACTIVOS} no tiene la tabla «| Componente del catálogo | Destino | Fecha | Motivo |».`
		);
		return [];
	}
	const rows = [];
	for (let i = start + 1; i < lines.length && (lines[i] ?? '').trim().startsWith('|'); i++) {
		const cells = (lines[i] ?? '')
			.trim()
			.replace(/^\||\|$/g, '')
			.split('|')
			.map((cell) => cell.trim().replace(/^`|`$/g, ''));
		if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
		const where = `${ACTIVOS}:${i + 1}`;
		const [origin = '', destination = '', date = '', reason = ''] = cells;
		if (cells.length !== 4 || !origin || !destination || !date || !reason) {
			errors.push(
				`${where}: fila mal formada; cada fila lleva componente, destino, fecha y motivo.`
			);
			continue;
		}
		if (!ISO_DATE.test(date))
			errors.push(`${where}: la fecha «${date}» no tiene el formato AAAA-MM-DD.`);
		rows.push({ where, origin: catalogRelative(origin), destination: toPosix(destination), date });
	}
	return rows;
}

/** Ruta del catálogo declarada con `@promovido-de` en la cabecera del fichero, si la hay. */
function promotedFrom(file) {
	const header = readFileSync(abs(file), 'utf8').split('\n').slice(0, HEADER_LINES).join('\n');
	const match = PROMOTED_FROM.exec(header);
	return match ? catalogRelative(match[1] ?? '') : undefined;
}

// b) y d) Cada activo existe en el catálogo y en su destino, y el destino declara su origen.
function checkActivos(rows) {
	const errors = [];
	const seenOrigins = new Map();
	const seenDestinations = new Map();
	for (const row of rows) {
		const { where, origin, destination } = row;
		if (seenOrigins.has(origin))
			errors.push(`${where}: «${origin}» ya figura en ${seenOrigins.get(origin)}.`);
		seenOrigins.set(origin, where);
		if (seenDestinations.has(destination))
			errors.push(
				`${where}: el destino «${destination}» ya figura en ${seenDestinations.get(destination)}.`
			);
		seenDestinations.set(destination, where);

		if (!existsSync(abs(`${CATALOG}/${origin}`)))
			errors.push(`${where}: «${origin}» no existe en el catálogo (${CATALOG}/${origin}).`);
		if (!PROMOTION_DIRS.some((dir) => destination.startsWith(`${dir}/`))) {
			errors.push(
				`${where}: el destino «${destination}» no está en ${PROMOTION_DIRS.join(' ni en ')}; ` +
					'un componente promovido vive ahí.'
			);
			continue;
		}
		if (!existsSync(abs(destination))) {
			errors.push(
				`${where}: el componente promovido «${origin}» no existe en su destino «${destination}». ` +
					'Cópialo y adáptalo, o quita la fila si se retiró.'
			);
			continue;
		}
		const declared = promotedFrom(destination);
		if (declared !== origin) {
			errors.push(
				`${destination}: le falta en la cabecera «@promovido-de ${origin}» (figura así en ${where})` +
					(declared === undefined ? '.' : `; declara «${declared}».`)
			);
		}
	}
	return errors;
}

// c) Lo que dice venir del catálogo figura en la lista y existe en el catálogo.
function checkDeclarations(rows) {
	const errors = [];
	const byOrigin = new Map(rows.map((row) => [row.origin, row]));
	const files = PROMOTION_DIRS.flatMap((dir) => walk(dir, undefined)).filter((f) => CODE.test(f));
	for (const file of files) {
		const origin = promotedFrom(file);
		if (origin === undefined) continue;
		if (!existsSync(abs(`${CATALOG}/${origin}`)))
			errors.push(`${file}: declara «@promovido-de ${origin}», que no existe en el catálogo.`);
		const row = byOrigin.get(origin);
		if (row === undefined)
			errors.push(
				`${file}: declara «@promovido-de ${origin}», que no figura en ${ACTIVOS}. Añade su fila ` +
					'(componente, destino, fecha y motivo).'
			);
		else if (row.destination !== file)
			errors.push(
				`${file}: declara «@promovido-de ${origin}», pero ${row.where} lo asigna a «${row.destination}».`
			);
	}
	return errors;
}

const errors = [];
const imports = findCatalogImports();
errors.push(...imports.errors);
const rows = readActivos(errors);
errors.push(...checkActivos(rows), ...checkDeclarations(rows));

if (errors.length > 0) {
	console.error(
		`El catálogo del sistema de diseño no está aislado (${errors.length} problema(s)):`
	);
	for (const error of errors) console.error(`  - ${error}`);
	console.error(`Reglas de promoción: ${ACTIVOS}.`);
	process.exit(1);
}
console.log(
	`Catálogo aislado: ${imports.scanned} fichero(s) de ${SCANNED_ROOTS.join(', ')} sin importaciones del catálogo; ` +
		`${rows.length} componente(s) promovido(s) en ACTIVOS.md, todos en su destino.`
);
