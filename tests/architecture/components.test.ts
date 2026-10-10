// Componentes (constitución, «Organización de componentes»; ARCHITECTURE.md §7). `components/layout/` importa solo
// `ui/`, utilidades de formato, el catálogo de textos (Paraglide), tipos de apariencia y las APIs de SvelteKit.
// Ningún componente importa código de servidor, y `ui/` no conoce el marco ni el sistema de diseño.
import { describe, expect, it } from 'vitest';
import { moduleSpecifiers, sourceFiles } from './source';

const LAYOUT_ALLOWED = [
	/^\.\.?\/ui\//,
	/^\.\.?\/layout\//,
	/^\.\/[^/]+\.svelte$/,
	/^\$lib\/paraglide\//,
	/^\$lib\/appearance\//,
	/^\$lib\/format(\/|$)/,
	/^\$app\//,
	/^svelte(\/|$)/
];

function allowedInLayout(specifier: string): boolean {
	return LAYOUT_ALLOWED.some((pattern) => pattern.test(specifier));
}

describe('componentes', () => {
	it('layout/ solo importa ui/, textos, apariencia, formato y las APIs de SvelteKit', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			if (!file.path.startsWith('src/lib/components/layout/')) continue;
			for (const specifier of moduleSpecifiers(file.ast)) {
				if (!allowedInLayout(specifier)) offenders.push(`${file.path} → ${specifier}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('ningún componente importa código de servidor', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			if (!file.path.startsWith('src/lib/components/')) continue;
			for (const specifier of moduleSpecifiers(file.ast)) {
				if (specifier.startsWith('$lib/server')) offenders.push(`${file.path} → ${specifier}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('ui/ no importa el marco ni el sistema de diseño', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			if (!file.path.startsWith('src/lib/components/ui/')) continue;
			for (const specifier of moduleSpecifiers(file.ast)) {
				if (/layout\/|design-system/.test(specifier)) offenders.push(`${file.path} → ${specifier}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
