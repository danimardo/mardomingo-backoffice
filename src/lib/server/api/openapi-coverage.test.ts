// Cobertura del OpenAPI (E01–E14; T-DOC): cada ruta pública de `src/routes/api/v1` aparece en el documento y el documento
// no declara rutas que no existen. Las rutas comodín (`[...path]`, el 404 de la API) y la propia descripción no cuentan.
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';

const API_ROOT = join(process.cwd(), 'src', 'routes', 'api', 'v1');
const EXCLUDED = new Set(['[...path]', 'openapi.json']);

function serverRoutes(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			found.push(...serverRoutes(full));
		} else if (entry === '+server.ts') {
			const route = '/' + relative(API_ROOT, dir).split(sep).join('/');
			const segments = route.split('/').filter(Boolean);
			if (segments.some((segment) => EXCLUDED.has(segment))) continue;
			found.push(route === '/' ? '/' : route);
		}
	}
	return found.sort();
}

describe('cobertura del OpenAPI', () => {
	const documented = Object.keys(
		buildOpenApiDocument('https://api.example.test').paths ?? {}
	).sort();

	it('todas las rutas de src/routes/api/v1 están en el documento', () => {
		expect(documented).toEqual(expect.arrayContaining(serverRoutes(API_ROOT)));
	});

	it('el documento no declara rutas que no existen', () => {
		expect(serverRoutes(API_ROOT)).toEqual(expect.arrayContaining(documented));
	});
});
