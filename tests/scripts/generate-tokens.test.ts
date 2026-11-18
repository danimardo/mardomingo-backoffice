// Pruebas del generador de tokens de color (T454; ADR 0009): la aritmética de contraste WCAG 2.2 con valores conocidos,
// la escala OKLCH con sus anclas y la verificación de `pnpm tokens:check` sobre el `tokens.css` real y sobre una copia
// con la región generada editada a mano.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	STEPS,
	buildScale,
	composite,
	contrast,
	evaluate,
	mix,
	relLuminance
} from '../../scripts/tokens/color.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'generate-tokens.mjs');
const TOKENS = join('src', 'lib', 'design-system', 'tokens.css');

describe('contraste WCAG 2.2', () => {
	it('blanco sobre negro es 21:1 y un color consigo mismo 1:1', () => {
		expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
		expect(contrast('#11813F', '#11813F')).toBeCloseTo(1, 5);
	});

	it('reproduce las cifras publicadas (gris #777 sobre blanco, pares del documento de BeCall)', () => {
		expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
		expect(contrast('#FFFFFF', '#006E89')).toBeCloseTo(5.85, 2);
		expect(contrast('#3D3D3D', '#E99B35')).toBeCloseTo(4.76, 2);
		expect(contrast('#101A20', '#7DCDDF')).toBeCloseTo(9.8, 1);
	});

	it('es simétrico y usa la luminancia relativa sRGB', () => {
		expect(contrast('#626F78', '#F7F9FA')).toBeCloseTo(contrast('#F7F9FA', '#626F78'), 10);
		expect(relLuminance('#FFFFFF')).toBeCloseTo(1, 10);
		expect(relLuminance('#000000')).toBe(0);
	});
});

describe('mezclas', () => {
	it('mix calcula color-mix(in srgb) y composite pinta un rgba sobre un fondo opaco', () => {
		expect(mix('#FFFFFF', 0.5, '#000000')).toBe('#808080');
		expect(composite('rgba(255, 255, 255, 0.5)', '#000000')).toBe('#808080');
		expect(composite('#123456', '#FFFFFF')).toBe('#123456');
		expect(composite('rgba(0,0,0,0)', '#ABCDEF')).toBe('#ABCDEF');
	});
});

describe('escala OKLCH', () => {
	it('conserva las anclas, rellena los once pasos y oscurece de forma monótona', () => {
		const scale = buildScale({ 50: '#F0F8F3', 300: '#6BB287', 600: '#11813F', 950: '#04200E' });

		expect(Object.keys(scale).map(Number)).toEqual(STEPS);
		expect(scale[300]).toBe('#6BB287');
		expect(scale[600]).toBe('#11813F');
		for (let i = 1; i < STEPS.length; i++) {
			const step = STEPS[i] ?? 0;
			const previous = STEPS[i - 1] ?? 0;
			expect(relLuminance(scale[step] ?? '')).toBeLessThan(relLuminance(scale[previous] ?? ''));
		}
	});

	it('exige ancla en 50 y en 950', () => {
		expect(() => buildScale({ 50: '#FFFFFF', 500: '#808080' })).toThrow(/50 y 950/);
	});
});

describe('evaluate', () => {
	it('marca como fallo un par por debajo de su mínimo y como válido el que llega', () => {
		const results = evaluate([
			{ theme: 'light', label: 'gris claro / blanco', fg: '#777777', bg: '#FFFFFF', min: 4.5 },
			{ theme: 'light', label: 'borde / blanco', fg: '#777777', bg: '#FFFFFF', min: 3 }
		]);

		expect(results.map((result) => result.ok)).toEqual([false, true]);
	});
});

describe('tokens.css', () => {
	const css = readFileSync(join(ROOT, TOKENS), 'utf8');
	const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));

	it('el claro es la base y el oscuro se aplica por elección o por preferencia del sistema (DS-02)', () => {
		expect(css).toMatch(/:root\[data-theme='dark'\] \{\s*color-scheme: dark;/);
		expect(css).toMatch(
			/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{/
		);
		expect(css).not.toContain('light-dark(');
	});

	it('las preferencias de accesibilidad ganan a los temas y los efectos reducidos van los últimos (DS-05)', () => {
		const end = css.indexOf('@generated:color:end');
		for (const media of [
			'prefers-reduced-transparency',
			'prefers-contrast: more',
			'forced-colors'
		]) {
			const at = css.indexOf(`@media (${media}`);
			expect(at).toBeGreaterThan(end);
			expect(css.slice(at, at + 120)).toContain(':root:is([data-theme], :not([data-theme]))');
		}
		expect(css.lastIndexOf(":root[data-effects='reduced']")).toBeGreaterThan(
			css.indexOf('@media (forced-colors')
		);
	});

	it('define todos los tokens que usa la app fuera del catálogo', () => {
		const used = new Set<string>();
		const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter(
			(file) =>
				/\.(svelte|css|ts)$/.test(file) && !/^lib[\\/](design-catalog|paraglide)[\\/]/.test(file)
		);
		for (const file of files) {
			const text = readFileSync(join(ROOT, 'src', file), 'utf8');
			for (const [, name] of text.matchAll(/var\((--[a-z0-9]+(?:-[a-z0-9]+)*)\)/g)) {
				if (name && !name.startsWith('--gg-')) used.add(name);
			}
		}

		expect([...used].filter((name) => !defined.has(name) && name !== '--token')).toEqual([]);
	});

	it('conserva los colores de los emails como hex legibles por la plantilla', () => {
		for (const name of [
			'email-action-bg',
			'email-action-text',
			'email-dark-bg',
			'email-dark-text'
		]) {
			expect(css).toMatch(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
		}
	});
});

describe('pnpm tokens:check', () => {
	let dir = '';

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = '';
	});

	function run(args: string[]) {
		return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
	}

	it('el tokens.css del repositorio está al día y todos los pares cumplen AA', () => {
		const result = run(['--check']);

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		expect(result.stdout).toMatch(/pares comprobados — 0 fallos/);
	});

	it('falla si alguien edita a mano la región generada', () => {
		dir = mkdtempSync(join(tmpdir(), 'tokens-'));
		mkdirSync(join(dir, 'src', 'lib', 'design-system'), { recursive: true });
		const css = readFileSync(join(ROOT, TOKENS), 'utf8');
		writeFileSync(
			join(dir, TOKENS),
			css.replace(/--primary-600: #[0-9A-Fa-f]{6};/, '--primary-600: #00FF00;')
		);

		const result = run(['--check', '--root', dir]);

		expect(result.status).toBe(1);
		expect(result.stderr).toMatch(/no coincide con lo generado/);
	});
});
