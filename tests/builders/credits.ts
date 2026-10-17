// Montaje de `credits` para las pruebas de integración (T121): base de datos real de la plantilla, reloj que avanza a mano,
// registrador falso y el servicio ya creado. Las cuentas se insertan directamente (sin pasar por el registro).
import { createCredits, type Credits, type CreditsDeps } from '$lib/server/features/credits';
import { user } from '$lib/server/features/accounts/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import { copyOfTemplate, type TestDatabase } from './database';
import { createFakeLogger, type FakeLogger } from './fake-logger';
import { seededRandomBytes } from './ids';

export { mutableClock, type MutableClock } from './clock';
import { mutableClock, type MutableClock } from './clock';

export interface CreditsFixture {
	readonly database: TestDatabase;
	readonly db: TestDatabase['db'];
	readonly logger: FakeLogger;
	readonly clock: MutableClock;
	readonly credits: Credits;
	/** Dependencias del servicio, para las lecturas que no pasan por la API pública (pruebas de servicio). */
	readonly deps: CreditsDeps;
	/** Inserta una cuenta mínima (sin registro) y devuelve su id. */
	addUser(id: string, role?: string): string;
	close(): void;
}

export function creditsFixture(start: number = Date.now()): CreditsFixture {
	const database = copyOfTemplate();
	const db = database.db;
	const logger = createFakeLogger();
	const clock = mutableClock(start);
	const ids = createIdGenerator(seededRandomBytes(41));
	const credits = createCredits({
		db,
		logger,
		clock,
		ids,
		apps: { db, logger, clock, ids },
		auditDeps: { clock, ids, logger }
	});
	const deps: CreditsDeps = {
		db,
		logger,
		clock,
		ids,
		apps: { db, logger, clock, ids }
	};
	return {
		database,
		db,
		logger,
		clock,
		credits,
		deps,
		addUser(id, role = 'user') {
			db.insert(user)
				.values({ id, name: '', email: `${id}@ejemplo.es`, role })
				.run();
			return id;
		},
		close() {
			database.dispose();
		}
	};
}
