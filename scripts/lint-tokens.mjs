// Puerta 10 del CI (constitución, principio XIII): ningún color literal fuera del
// fichero de tokens del sistema de diseño. Comprueba hex, funciones de color
// literales y la paleta por defecto de Tailwind.
// Uso: pnpm lint:tokens
import { globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TOKENS_FILE = join('src', 'lib', 'design-system', 'tokens.css');

const RULES = [
	{ name: 'hex', re: /#[0-9a-fA-F]{3,8}\b/ },
	{ name: 'rgb/hsl literal', re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/ },
	{
		name: 'paleta por defecto de Tailwind',
		re: /\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
	},
	{
		name: 'color arbitrario de Tailwind',
		re: /\b(?:text|bg|border|ring|fill|stroke)-\[(?:#|rgb|hsl|oklch)/
	}
];

const files = globSync('src/**/*.{svelte,ts,js,css}', { cwd: ROOT }).filter(
	(file) => relative(ROOT, join(ROOT, file)) !== TOKENS_FILE && !file.includes('src/lib/paraglide')
);

const violations = [];
for (const file of files) {
	const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
	lines.forEach((line, index) => {
		if (/color-mix\(|currentColor/.test(line) && !/#[0-9a-fA-F]{3,8}\b/.test(line)) return;
		for (const rule of RULES) {
			if (rule.re.test(line)) violations.push(`${file}:${index + 1} [${rule.name}] ${line.trim()}`);
		}
	});
}

if (violations.length > 0) {
	console.error(`Colores literales fuera de ${TOKENS_FILE}:`);
	for (const violation of violations) console.error(`  ${violation}`);
	process.exit(1);
}
console.log(`Sin colores literales en ${files.length} fichero(s).`);
