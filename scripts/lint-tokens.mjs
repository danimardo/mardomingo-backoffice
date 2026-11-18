// Puerta 10 del CI (constitución, principio XIII): ningún color literal fuera de la región generada del fichero de
// tokens del sistema de diseño (entre `@generated:color:start` y `@generated:color:end`, que escribe `pnpm tokens`
// tras verificar el contraste; T454). El resto de tokens.css también se comprueba. Busca hex, funciones de color
// literales y la paleta por defecto de Tailwind.
// Uso: pnpm lint:tokens
import { globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TOKENS_FILE = join('src', 'lib', 'design-system', 'tokens.css');
// El catálogo del sistema de diseño se copió sin adaptar y no se comprueba (ADR 0009, T453): sus colores literales se
// sustituyen por tokens al promover cada componente a components/ui o layout, y entonces este script ya lo ve.
const EXCLUDED = /^src[\\/]lib[\\/](?:paraglide|design-catalog)[\\/]/;

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
	(file) => !EXCLUDED.test(file)
);

const violations = [];
for (const file of files) {
	const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
	const isTokens = relative(ROOT, join(ROOT, file)) === TOKENS_FILE;
	if (isTokens && !lines.some((line) => line.includes('@generated:color:end'))) {
		violations.push(
			`${file} [región generada] faltan los marcadores @generated:color:start y :end`
		);
	}
	let inGenerated = false;
	lines.forEach((line, index) => {
		if (isTokens) {
			const skip = inGenerated || line.includes('@generated:color:start');
			if (line.includes('@generated:color:start')) inGenerated = true;
			if (line.includes('@generated:color:end')) inGenerated = false;
			if (skip) return;
		}
		if (/color-mix\(|currentColor/.test(line) && !/#[0-9a-fA-F]{3,8}\b/.test(line)) return;
		for (const rule of RULES) {
			if (rule.re.test(line)) violations.push(`${file}:${index + 1} [${rule.name}] ${line.trim()}`);
		}
	});
}

if (violations.length > 0) {
	console.error(`Colores literales fuera de la región generada de ${TOKENS_FILE}:`);
	for (const violation of violations) console.error(`  ${violation}`);
	process.exit(1);
}
console.log(`Sin colores literales en ${files.length} fichero(s).`);
