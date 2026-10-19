// Bolsas de una cuenta para su ficha (W35; T306) contra SQLite real: la bienvenida deja una bolsa con su saldo íntegro, y solo se
// devuelven las bolsas de esa cuenta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { bucketsForAdmin } from './admin-buckets';

let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
});

afterEach(() => {
	f.close();
});

describe('bolsas de una cuenta para la ficha (T306)', () => {
	it('la bienvenida aparece como bolsa de su cuenta, con el saldo íntegro', () => {
		const userId = f.addUser('usr_ficha_bolsas');
		f.addUser('usr_ficha_bolsas_otra');
		f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-ficha-bolsas' });

		const rows = bucketsForAdmin(f.db, userId, 50);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ remainingMicro: rows[0]?.initialMicro });
		expect(rows[0]?.initialMicro).toBeGreaterThan(0);
	});
});
