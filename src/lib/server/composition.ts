// Composición de la aplicación (ARCHITECTURE.md §5): se construye una vez en `init`, con la configuración ya
// validada y el logger raíz. Las funcionalidades reciben sus dependencias por parámetro; nadie importa estado
// global salvo el contenedor de `composition.cache.ts`.
import type Database from 'better-sqlite3';
import { createSystemClock, type Clock } from './adapters/clock/clock';
import type { Env } from './config/env-schema';
import { openDatabase, type Db } from './db/client';
import type { Logger } from './logging/logger';
import { createIdGenerator, type IdGenerator } from './shared/ids';

export interface Composition {
	readonly config: Env;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly db: Db;
	readonly sqlite: Database.Database;
	close(): void;
}

export function createComposition(config: Env, logger: Logger): Composition {
	const { sqlite, db } = openDatabase(config.DATABASE_PATH);
	return {
		config,
		logger,
		// En L01 el reloj y la BD son los únicos adaptadores. Los proveedores, el email y el captcha llegan
		// con sus lotes; en `APP_ENV=test` apuntarán a los simuladores por URL base (T038).
		clock: createSystemClock(),
		ids: createIdGenerator(),
		db,
		sqlite,
		close: () => {
			sqlite.close();
		}
	};
}
