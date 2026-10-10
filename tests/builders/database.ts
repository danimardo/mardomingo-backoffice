// Base de datos de prueba: una copia de la plantilla ya migrada y sembrada (T083). Cada prueba obtiene la suya, en un
// directorio temporal propio, y la cierra al terminar. Copiar es mucho más barato que migrar en cada prueba.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type OpenedDatabase } from '$lib/server/db/client';
import { TEMPLATE_DB } from '../setup/integration.global-setup';

export interface TestDatabase extends OpenedDatabase {
	/** Cierra la conexión y borra el directorio temporal. */
	dispose(): void;
}

export function copyOfTemplate(): TestDatabase {
	const dir = mkdtempSync(join(tmpdir(), 'mdm-int-'));
	const path = join(dir, 'app.db');
	copyFileSync(TEMPLATE_DB, path);
	const opened = openDatabase(path);
	return {
		...opened,
		dispose: () => {
			opened.sqlite.close();
			rmSync(dir, { recursive: true, force: true });
		}
	};
}
