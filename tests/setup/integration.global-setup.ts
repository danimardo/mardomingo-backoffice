// Prepara una BD plantilla una vez por ejecución (T035). Las pruebas de integración copian este fichero en vez
// de migrar en cada prueba. Sin migraciones todavía, la plantilla queda vacía pero con el modo WAL aplicado.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '$lib/server/db/client';

export const TEMPLATE_DIR = join('tests', '.tmp', 'integration');
export const TEMPLATE_DB = join(TEMPLATE_DIR, 'template.db');

export default function setup(): () => void {
	rmSync(TEMPLATE_DIR, { recursive: true, force: true });
	mkdirSync(TEMPLATE_DIR, { recursive: true });
	const { sqlite } = openDatabase(TEMPLATE_DB);
	sqlite.pragma('wal_checkpoint(TRUNCATE)');
	sqlite.close();
	return () => {
		rmSync(TEMPLATE_DIR, { recursive: true, force: true });
	};
}
