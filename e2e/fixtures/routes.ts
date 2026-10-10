// Rutas públicas de la aplicación, generadas desde `src/routes` (Historias.md 15.18). Así una página nueva
// entra sola en las pruebas de accesibilidad y de apariencia, y una ruta que falte en la lista es un fallo.
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROUTES_DIR = join('src', 'routes');

/** Segmentos que no forman parte de la URL: grupos `(web)` y similares. */
function isGroup(segment: string): boolean {
	return segment.startsWith('(') && segment.endsWith(')');
}

function pagesUnder(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			pagesUnder(full, found);
		} else if (entry === '+page.svelte') {
			found.push(full);
		}
	}
	return found;
}

/** Ruta de URL de cada `+page.svelte` que no tiene parámetros dinámicos (los de `[...]` se prueban aparte). */
export function staticPublicRoutes(): string[] {
	const routes = pagesUnder(ROUTES_DIR).map((file) => {
		const segments = relative(ROUTES_DIR, file)
			.split(sep)
			.slice(0, -1)
			.filter((s) => !isGroup(s));
		return `/${segments.join('/')}`.replace(/\/$/, '') || '/';
	});
	return routes.filter((route) => !route.includes('[')).sort();
}
