// Limpieza de cuentas sin verificar contra SQLite real y reloj falso (BE-FR-68, US10 escenario 6; T294): las que superan
// `unverified_account_ttl_days` se borran por completo, con sus aceptaciones y sus tokens, y el email queda libre; las de menos
// días, las verificadas y las ya borradas no se tocan.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { privacyFixture, type PrivacyFixture } from '../../../../../tests/builders/privacy';
import { DAY_MS } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { termsAcceptances } from '../legal/schema';
import { session, user, verification } from './schema';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);
const TTL_DAYS = 7;

let f: PrivacyFixture;

beforeEach(async () => {
	f = await privacyFixture();
	f.panel.fixture.base.clock.set(NOW);
});

afterEach(() => {
	f.close();
});

const db = () => f.panel.fixture.base.db;

function addAccount(id: string, ageDays: number, verified: boolean): string {
	db()
		.insert(user)
		.values({
			id,
			name: '',
			email: `${id}@ejemplo.es`,
			emailVerified: verified,
			createdAt: new Date(NOW - ageDays * DAY_MS)
		})
		.run();
	return id;
}

function exists(id: string): boolean {
	return db().select().from(user).where(eq(user.id, id)).get() !== undefined;
}

describe('purgeUnverified (BE-FR-68)', () => {
	it('borra por completo las de más de 7 días y conserva las de 6, las verificadas y las ya existentes', () => {
		const old = addAccount('usr_sin_verificar_8d', 8, false);
		const recent = addAccount('usr_sin_verificar_6d', 6, false);
		const verified = addAccount('usr_verificada_30d', 30, true);

		const purged = f.accounts.purgeUnverified(TTL_DAYS);

		expect(purged).toBe(1);
		expect(exists(old)).toBe(false);
		expect(exists(recent)).toBe(true);
		expect(exists(verified)).toBe(true);
		expect(exists(f.userId)).toBe(true);
		expect(exists(f.otherUserId)).toBe(true);
		expect(
			eventsNamed(f.panel.fixture.base.logger, 'accounts.unverified.purged').map(
				(event) => event.fields
			)
		).toEqual([{ count: 1 }]);
	});

	it('el límite es exacto: con 7 días justos se conserva y con algo más se borra', () => {
		const exact = addAccount('usr_exacta', TTL_DAYS, false);
		db()
			.insert(user)
			.values({
				id: 'usr_pasada',
				name: '',
				email: 'usr_pasada@ejemplo.es',
				emailVerified: false,
				createdAt: new Date(NOW - TTL_DAYS * DAY_MS - 1)
			})
			.run();

		f.accounts.purgeUnverified(TTL_DAYS);

		expect(exists(exact)).toBe(true);
		expect(exists('usr_pasada')).toBe(false);
	});

	it('sus aceptaciones y sus sesiones caen en cascada y sus tokens se borran', () => {
		const id = addAccount('usr_con_datos', 10, false);
		db()
			.insert(termsAcceptances)
			.values({
				id: 'tac_cascada',
				userId: id,
				document: 'terms',
				version: '2026-10-11',
				acceptedAt: toEpochMs(NOW - 10 * DAY_MS),
				ip: '203.0.113.7',
				appId: null
			})
			.run();
		db()
			.insert(session)
			.values({
				id: 'ses_cascada',
				userId: id,
				token: 'tok_cascada',
				expiresAt: new Date(NOW + DAY_MS),
				createdAt: new Date(NOW - DAY_MS),
				updatedAt: new Date(NOW - DAY_MS)
			})
			.run();
		db()
			.insert(verification)
			.values({
				id: 'ver_reset_cascada',
				identifier: 'reset-password:abc',
				value: id,
				expiresAt: new Date(NOW + DAY_MS)
			})
			.run();

		f.accounts.purgeUnverified(TTL_DAYS);

		expect(exists(id)).toBe(false);
		expect(
			db().select().from(termsAcceptances).where(eq(termsAcceptances.id, 'tac_cascada')).get()
		).toBe(undefined);
		expect(db().select().from(session).where(eq(session.id, 'ses_cascada')).get()).toBe(undefined);
		expect(
			db().select().from(verification).where(eq(verification.id, 'ver_reset_cascada')).get()
		).toBe(undefined);
	});

	it('el email queda libre: se puede dar de alta otra cuenta con la misma dirección', () => {
		addAccount('usr_liberar', 9, false);
		f.accounts.purgeUnverified(TTL_DAYS);

		expect(() => addAccount('usr_liberar_nueva', 0, false)).not.toThrow();
		db()
			.update(user)
			.set({ email: 'usr_liberar@ejemplo.es' })
			.where(eq(user.id, 'usr_liberar_nueva'))
			.run();
		expect(
			db().select().from(user).where(eq(user.email, 'usr_liberar@ejemplo.es')).all()
		).toHaveLength(1);
	});

	it('repetirlo no borra nada más', () => {
		addAccount('usr_una_vez', 9, false);

		expect(f.accounts.purgeUnverified(TTL_DAYS)).toBe(1);
		expect(f.accounts.purgeUnverified(TTL_DAYS)).toBe(0);
	});
});
