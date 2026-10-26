// Cierre de una sesión desde W26 (T264; BE-FR-49.2) contra SQLite real: se cierra una sesión ajena de la cuenta, nunca la actual,
// y nunca una de otra cuenta.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { session } from './schema';
import { closeOtherSession, closeOtherSessions } from './close-session';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(NOW);
	userId = f.addUser('usr_cierre');
});

afterEach(() => {
	f.close();
});

function addSession(id: string, owner: string): void {
	f.db
		.insert(session)
		.values({
			id,
			userId: owner,
			token: `tok_${id}`,
			expiresAt: new Date(NOW + 86_400_000),
			createdAt: new Date(NOW),
			updatedAt: new Date(NOW)
		})
		.run();
}

function exists(id: string): boolean {
	return f.db.select().from(session).where(eq(session.id, id)).get() !== undefined;
}

describe('closeOtherSession (T264)', () => {
	it('cierra una sesión ajena de la cuenta', () => {
		addSession('ses_actual', userId);
		addSession('ses_otra', userId);

		const outcome = closeOtherSession(f.db, {
			userId,
			sessionId: 'ses_otra',
			currentSessionId: 'ses_actual'
		});

		expect(outcome).toBe('closed');
		expect(exists('ses_otra')).toBe(false);
		expect(exists('ses_actual')).toBe(true);
	});

	it('no cierra la sesión actual', () => {
		addSession('ses_actual', userId);

		expect(
			closeOtherSession(f.db, { userId, sessionId: 'ses_actual', currentSessionId: 'ses_actual' })
		).toBe('current');
		expect(exists('ses_actual')).toBe(true);
	});

	it('no cierra una sesión de otra cuenta', () => {
		addSession('ses_ajena', f.addUser('usr_cierre_otro'));

		expect(
			closeOtherSession(f.db, { userId, sessionId: 'ses_ajena', currentSessionId: 'ses_actual' })
		).toBe('not_found');
		expect(exists('ses_ajena')).toBe(true);
	});

	it('una sesión inexistente no encuentra nada', () => {
		expect(
			closeOtherSession(f.db, { userId, sessionId: 'no_existe', currentSessionId: null })
		).toBe('not_found');
	});
});

describe('closeOtherSessions (UX-10)', () => {
	it('[UX-10] cierra todas las sesiones de la cuenta menos la actual y no toca otras cuentas', () => {
		const otra = f.addUser('usr_ajena');
		addSession('ses_actual', userId);
		addSession('ses_b', userId);
		addSession('ses_c', userId);
		addSession('ses_ajena', otra);

		const closed = closeOtherSessions(f.db, { userId, currentSessionId: 'ses_actual' });

		expect(closed).toBe(2);
		expect(exists('ses_actual')).toBe(true);
		expect(exists('ses_b')).toBe(false);
		expect(exists('ses_c')).toBe(false);
		expect(exists('ses_ajena')).toBe(true);
	});

	it('sin sesión actual legible no cierra nada', () => {
		addSession('ses_b', userId);

		expect(closeOtherSessions(f.db, { userId, currentSessionId: null })).toBe(0);
		expect(exists('ses_b')).toBe(true);
	});
});
