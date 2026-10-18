// Bloqueo por reaceptación contra SQLite real (BE-FR-70 CA1; T314): una versión que exige reaceptación deja pendiente a cada cuenta
// que no la haya aceptado (y por tanto bloquea IA y sincronización), una informativa no bloquea, y aceptar la versión libera la cuenta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { termsAcceptances } from './schema';
import { pendingAcceptancesOf } from './pending';
import { publishVersion } from './publish';

let f: CreditsFixture;
let adminId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_pendiente', 'admin');
});

afterEach(() => {
	f.close();
});

function publish(version: string, requiresReacceptance: boolean) {
	publishVersion(
		{
			db: f.db,
			logger: f.logger,
			clock: f.clock,
			ids: f.deps.ids,
			audit: { clock: f.clock, ids: f.deps.ids, logger: f.logger }
		},
		{
			adminId,
			document: 'terms',
			version,
			content: `# Términos ${version}`,
			requiresReacceptance
		}
	);
}

function accept(userId: string, version: string) {
	f.db
		.insert(termsAcceptances)
		.values({
			id: `acc_${userId}_${version}`,
			userId,
			document: 'terms',
			version,
			acceptedAt: f.clock.now()
		})
		.run();
}

describe('bloqueo por reaceptación (T314)', () => {
	it('una versión que exige reaceptación deja pendiente a la cuenta que no la aceptó', () => {
		const userId = f.addUser('usr_bloqueada');
		publish('2026-11-01', true);

		expect(pendingAcceptancesOf(f.db, userId, f.clock.now())).toContainEqual({
			document: 'terms',
			version: '2026-11-01'
		});
	});

	it('una versión informativa no bloquea a nadie', () => {
		const userId = f.addUser('usr_informada');
		publish('2026-11-01', false);

		expect(
			pendingAcceptancesOf(f.db, userId, f.clock.now()).filter((p) => p.document === 'terms')
		).toEqual([]);
	});

	it('aceptar la versión que exige reaceptación libera la cuenta', () => {
		const userId = f.addUser('usr_acepta');
		publish('2026-11-01', true);
		accept(userId, '2026-11-01');

		expect(
			pendingAcceptancesOf(f.db, userId, f.clock.now()).filter((p) => p.document === 'terms')
		).toEqual([]);
	});
});
