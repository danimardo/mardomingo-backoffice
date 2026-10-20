// Bolsas del saldo para el resumen del panel contra SQLite real (T258; BE-FR-49.1, BE-FR-22): solo las que tienen saldo, con su
// tipo, origen, saldo restante, fecha de caducidad (día de Madrid) y marca de simulada. Sin ids internos.
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { bucketsOf } from './service';

const CREDIT = 1_000_000;
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = f.addUser('usr_bolsas');
});

afterEach(() => {
	f.close();
});

describe('bucketsOf (BE-FR-49.1)', () => {
	it('lista las bolsas con saldo: gratuita de bienvenida con su caducidad y la compra simulada', () => {
		f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-bolsas' });
		f.credits.adjust({
			idempotencyKey: randomUUID(),
			adminId: f.addUser('adm_bolsas', 'admin'),
			userId,
			direction: 'credit',
			kind: 'paid',
			amountMicro: 5 * CREDIT,
			reason: 'recarga de prueba'
		});

		const buckets = bucketsOf(f.deps, userId);

		expect(buckets.map((bucket) => [bucket.kind, bucket.source])).toEqual([
			['free', 'welcome'],
			['paid', 'adjustment']
		]);
		expect(buckets[0]).toMatchObject({ remainingMicro: 1000 * CREDIT, simulated: false });
		expect(buckets[0]?.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(buckets[1]).toMatchObject({ expiresOn: null, remainingMicro: 5 * CREDIT });
		expect(Object.keys(buckets[0] ?? {}).sort()).toEqual([
			'expiresOn',
			'kind',
			'remainingMicro',
			'simulated',
			'source'
		]);
	});

	it('sin bolsas con saldo, la lista está vacía', () => {
		expect(bucketsOf(f.deps, userId)).toEqual([]);
	});
});
