// Tarea `free-credits-expiry` (T330; BE-FR-16, FR-026): avisa antes de caducar, después caduca, y un fallo de envío no detiene la
// caducidad. El servicio de créditos y el envío se sustituyen aquí: cada uno ya está probado en sus pruebas de integración
// (`credits/expiry-warning.int.test.ts`).
import { describe, expect, it } from 'vitest';
import { runFreeCreditsExpiry, type ExpiryWarning } from './free-credits-expiry';

const DAY_MS = 24 * 60 * 60 * 1000;
const emailOf = (userId: string): string | null =>
	userId === 'usr_sin_correo' ? null : `${userId}@ejemplo.es`;

describe('tarea free-credits-expiry (T330; BE-FR-16)', () => {
	it('avisa de cada bolsa que caduca pronto, una vez por usuario, y después caduca', async () => {
		const order: string[] = [];
		const sent: ExpiryWarning[] = [];
		const credits = {
			warnExpiringBuckets: (windowMs: number) => {
				order.push(`warn:${String(windowMs / DAY_MS)}`);
				return ['usr_a', 'usr_b'];
			},
			expireBuckets: () => {
				order.push('expire');
				return 2;
			}
		};

		const expired = await runFreeCreditsExpiry({
			credits,
			emailOf,
			sendWarning: (warning) => {
				sent.push(warning);
				return Promise.resolve(true);
			},
			warningDays: 7
		});

		expect(expired).toBe(2);
		expect(order).toStrictEqual(['warn:7', 'expire']);
		expect(sent).toHaveLength(2);
		expect(sent[0]).toMatchObject({
			reason: 'free_expiry_warning',
			to: 'usr_a@ejemplo.es',
			expiry: { days: 7 }
		});
	});

	it('un usuario sin correo no recibe aviso, pero su bolsa caduca igualmente', async () => {
		const sent: ExpiryWarning[] = [];

		const expired = await runFreeCreditsExpiry({
			credits: { warnExpiringBuckets: () => ['usr_sin_correo'], expireBuckets: () => 1 },
			emailOf,
			sendWarning: (warning) => {
				sent.push(warning);
				return Promise.resolve(true);
			},
			warningDays: 7
		});

		expect(expired).toBe(1);
		expect(sent).toHaveLength(0);
	});

	it('un fallo de envío no detiene la caducidad', async () => {
		const expired = await runFreeCreditsExpiry({
			credits: { warnExpiringBuckets: () => ['usr_a'], expireBuckets: () => 3 },
			emailOf,
			sendWarning: () => Promise.resolve(false),
			warningDays: 7
		});

		expect(expired).toBe(3);
	});
});
