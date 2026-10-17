// Guardas de administración (BE-FR-10; T301): cada `+page.server.ts` y `+server.ts` bajo `src/routes/(web)/admin/` comprueba el
// rol de administrador con `accessFor(..., 'admin')` en su `load` o en sus acciones. Así una página nueva no nace sin guarda.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_ROOT = join('src', 'routes', '(web)', 'admin');

function serverFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) serverFiles(full, found);
		else if (/^\+(page\.server|server)\.ts$/.test(entry)) found.push(full);
	}
	return found;
}

describe('guardas de administración (T301)', () => {
	const files = serverFiles(ADMIN_ROOT);

	it('hay páginas de administración que proteger (el test no es vacío)', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('cada fichero de servidor del área de administración exige el rol admin', () => {
		const unguarded = files.filter((file) => {
			const text = readFileSync(file, 'utf8');
			return !/accessFor\([^)]*,\s*'admin'\)/.test(text);
		});
		expect(unguarded).toEqual([]);
	});
});
