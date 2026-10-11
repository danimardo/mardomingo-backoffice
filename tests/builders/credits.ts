// Montaje de `credits` para las pruebas de integración (T121): base de datos real de la plantilla, reloj que avanza a mano,
// registrador falso y el servicio ya creado. Las cuentas se insertan directamente (sin pasar por el registro).
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { createCredits, type Credits } from '$lib/server/features/credits';
import { user } from '$lib/server/features/accounts/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import type { CivilDate } from '$lib/shared/time';
import { copyOfTemplate, type TestDatabase } from './database';
import { createFakeLogger, type FakeLogger } from './fake-logger';
import { seededRandomBytes } from './ids';

export interface MutableClock {
	now(): EpochMs;
	today(): CivilDate;
	set(instant: number): void;
	advance(milliseconds: number): void;
}

/** Reloj que solo avanza cuando la prueba lo pide: los plazos (caducidades, reservas) son reproducibles. */
export function mutableClock(start: number): MutableClock {
	let current = start;
	return {
		now: () => toEpochMs(current),
		today: () => civilDateOf(toEpochMs(current)),
		set(instant) {
			current = instant;
		},
		advance(milliseconds) {
			current += milliseconds;
		}
	};
}

export interface CreditsFixture {
	readonly database: TestDatabase;
	readonly db: TestDatabase['db'];
	readonly logger: FakeLogger;
	readonly clock: MutableClock;
	readonly credits: Credits;
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
	return {
		database,
		db,
		logger,
		clock,
		credits,
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
