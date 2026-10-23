// Prepara una BD plantilla una vez por ejecución (T035, T083, T390): la migra con `migrateDatabase`, la misma función
// que usa el arranque, y aplica los datos iniciales. Las pruebas de integración copian este fichero en vez de migrar
// y sembrar en cada prueba (`tests/builders/database.ts`).
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createSystemClock } from '$lib/server/adapters/clock/clock';
import { openDatabase } from '$lib/server/db/client';
import { migrateDatabase } from '$lib/server/db/migrate';
import { seedDefaults } from '$lib/server/seed';
import { createIdGenerator } from '$lib/server/shared/ids';
import { createFakeLogger } from '../builders/fake-logger';

export const TEMPLATE_DIR = join('tests', '.tmp', 'integration');
export const TEMPLATE_DB = join(TEMPLATE_DIR, 'template.db');

/** Identificador fijo de la app `secretario` que siembra el _seed_ (T080). */
export const SEEDED_APP_ID = 'app_secretario';

// En Windows el borrado puede chocar con un handle recién cerrado (EPERM/EBUSY); se reintenta antes de fallar.
function removeTemplateDir(): void {
	rmSync(TEMPLATE_DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

export default async function setup(): Promise<() => void> {
	removeTemplateDir();
	mkdirSync(TEMPLATE_DIR, { recursive: true });
	const { sqlite, db } = openDatabase(TEMPLATE_DB);
	await migrateDatabase({
		sqlite,
		db,
		migrationsFolder: 'drizzle',
		databasePath: TEMPLATE_DB,
		backupDir: join(TEMPLATE_DIR, 'pre-migrate'),
		keepBackups: 1,
		version: 'integration',
		logger: createFakeLogger()
	});
	seedDefaults(db, createSystemClock(), createIdGenerator());
	sqlite.pragma('wal_checkpoint(TRUNCATE)');
	sqlite.close();
	return () => {
		removeTemplateDir();
	};
}
