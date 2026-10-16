// Vuelca el OpenAPI v1 a un fichero temporal para `pnpm docs:api`. Es una prueba de Vitest porque es la única forma, sin dependencias
// nuevas, de ejecutar el código con los alias `$lib`. Solo se ejecuta si existe el fichero de destino que indica el script; en la
// suite normal no hace nada y no escribe.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';

const PUBLIC_API_URL = 'https://api.mardomingo.com';
const TARGET = join(process.cwd(), 'node_modules', '.cache', 'docs-api', 'request.json');

it.runIf(existsSync(TARGET))('vuelca el OpenAPI a la carpeta temporal del script', () => {
	const document = buildOpenApiDocument(PUBLIC_API_URL);
	writeFileSync(
		join(process.cwd(), 'node_modules', '.cache', 'docs-api', 'openapi-v1.json'),
		JSON.stringify(document, null, 2) + '\n',
		'utf8'
	);
	expect(document.openapi).toBe('3.1.0');
});
