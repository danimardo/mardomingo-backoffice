// Última actividad de la cuenta (T259; BE-FR-86) contra SQLite real: entrar al panel la marca con la hora actual, sin tocar otros datos.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { toEpochMs } from '$lib/shared/time';
import { user } from './schema';
import { touchActivity } from './activity';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(NOW);
	userId = f.addUser('usr_actividad');
});

afterEach(() => {
	f.close();
});

describe('touchActivity (BE-FR-86)', () => {
	it('marca la última actividad con la hora dada y deja el resto de la cuenta igual', () => {
		touchActivity(f.db, userId, toEpochMs(NOW + 60_000));

		const row = f.db.select().from(user).where(eq(user.id, userId)).get();

		expect(row?.lastActivityAt).toBe(NOW + 60_000);
		expect(row?.email).toBe(`${userId}@ejemplo.es`);
	});

	it('no escribe otra vez antes de una hora, y sí después', () => {
		touchActivity(f.db, userId, toEpochMs(NOW));
		touchActivity(f.db, userId, toEpochMs(NOW + 59 * 60_000));
		expect(f.db.select().from(user).where(eq(user.id, userId)).get()?.lastActivityAt).toBe(NOW);

		touchActivity(f.db, userId, toEpochMs(NOW + 60 * 60_000));
		expect(f.db.select().from(user).where(eq(user.id, userId)).get()?.lastActivityAt).toBe(
			NOW + 60 * 60_000
		);
	});

	it('una cuenta que no existe no falla', () => {
		expect(() => {
			touchActivity(f.db, 'usr_no_existe', toEpochMs(NOW));
		}).not.toThrow();
	});
});
