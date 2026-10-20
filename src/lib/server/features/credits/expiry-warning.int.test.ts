// Aviso previo a la caducidad del saldo gratuito contra SQLite real y reloj falso (BE-FR-16, FR-026; T330): el aviso sale una
// sola vez para una bolsa con saldo que caduca dentro de la ventana; una bolsa fuera de la ventana no avisa; y la caducidad
// después pone la bolsa a cero con su movimiento `expiry`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';

const DAY = 24 * 60 * 60 * 1000;
const WINDOW = 7 * DAY;

let fixture: CreditsFixture;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
});

afterEach(() => {
	fixture.close();
});

describe('aviso de caducidad del saldo gratuito (T330)', () => {
	it('avisa una sola vez cuando la bolsa caduca dentro de la ventana y conserva saldo', () => {
		const userId = fixture.addUser('usr_aviso');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-aviso' });

		fixture.clock.advance(24 * DAY);
		expect(fixture.credits.warnExpiringBuckets(WINDOW)).toEqual([userId]);
		expect(fixture.credits.warnExpiringBuckets(WINDOW)).toEqual([]);
		expect(
			eventsNamed(fixture.logger, 'credits.expiry.warned').map((event) => event.fields)
		).toEqual([{ count: 1 }]);
	});

	it('una bolsa que caduca después de la ventana no avisa todavía', () => {
		const userId = fixture.addUser('usr_lejos');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-lejos' });

		fixture.clock.advance(10 * DAY);
		expect(fixture.credits.warnExpiringBuckets(WINDOW)).toEqual([]);
	});

	it('una bolsa ya caducada no avisa, y la caducidad pone el saldo a cero', () => {
		const userId = fixture.addUser('usr_caducada');
		fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-caducada' });

		fixture.clock.advance(31 * DAY);
		expect(fixture.credits.warnExpiringBuckets(WINDOW)).toEqual([]);
		expect(fixture.credits.expireBuckets()).toBe(1);
		expect(fixture.credits.getBalance(userId).freeMicro).toBe(0);
	});
});
