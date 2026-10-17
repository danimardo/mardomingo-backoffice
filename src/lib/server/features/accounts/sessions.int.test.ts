// Sesiones del panel contra SQLite real (T264; BE-FR-49.1, BE-FR-49.2): solo las vigentes de la cuenta, sin token ni IP completa.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { toEpochMs } from '$lib/shared/time';
import { session } from './schema';
import { sessionsOf } from './sessions';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(NOW);
	userId = f.addUser('usr_sesiones');
});

afterEach(() => {
	f.close();
});

function addSession(id: string, owner: string, expiresAt: number, ip: string | null): void {
	f.db
		.insert(session)
		.values({
			id,
			userId: owner,
			token: `tok_${id}`,
			expiresAt: new Date(expiresAt),
			ipAddress: ip,
			userAgent: 'Mozilla/5.0',
			createdAt: new Date(NOW),
			updatedAt: new Date(NOW)
		})
		.run();
}

describe('sessionsOf (BE-FR-49.2)', () => {
	it('la forma es exacta: solo los campos de la vista, sin token ni IP completa (T258)', () => {
		addSession('ses_exacta', userId, NOW + 86_400_000, '203.0.113.42');

		expect(sessionsOf(f.db, userId, toEpochMs(NOW))).toStrictEqual([
			{
				id: 'ses_exacta',
				createdAt: toEpochMs(NOW),
				lastUsedAt: null,
				deviceName: null,
				approxIp: '203.0.113.x',
				userAgent: 'Mozilla/5.0'
			}
		]);
	});

	it('lista las sesiones vigentes con la IP aproximada y sin token', () => {
		addSession('ses_1', userId, NOW + 86_400_000, '203.0.113.42');

		const list = sessionsOf(f.db, userId, toEpochMs(NOW));

		expect(list).toEqual([expect.objectContaining({ id: 'ses_1', approxIp: '203.0.113.x' })]);
		expect(Object.keys(list[0] ?? {})).not.toContain('token');
		expect(JSON.stringify(list)).not.toContain('203.0.113.42');
	});

	it('no lista sesiones caducadas ni de otra cuenta', () => {
		addSession('ses_vieja', userId, NOW - 1, null);
		addSession('ses_ajena', f.addUser('usr_otro_ses'), NOW + 86_400_000, null);

		expect(sessionsOf(f.db, userId, toEpochMs(NOW))).toEqual([]);
	});
});
