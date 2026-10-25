// Tarea `free-credits-expiry` contra SQLite real y reloj falso (BE-FR-16, FR-026; T330): a lo largo de varios días y horas,
// la tarea avisa una sola vez por bolsa con saldo, caduca la bolsa con su movimiento `expiry`, y un fallo de envío no
// detiene la caducidad. Complementa las pruebas de `credits` (`expiry-warning.int.test.ts`) y las de la tarea con fakes.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { eventsNamed } from '../../../../tests/builders/fake-logger';
import { movementsPage } from '$lib/server/features/credits/service';
import { runFreeCreditsExpiry, type ExpiryWarning } from './free-credits-expiry';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WARNING_DAYS = 7;
const START = Date.UTC(2026, 9, 11, 8, 0, 0);

let fixture: CreditsFixture;
let userId: string;
let sent: ExpiryWarning[];
let sendOk: boolean;

function run(): Promise<number> {
	return runFreeCreditsExpiry({
		credits: fixture.credits,
		emailOf: () => 'cuenta@ejemplo.es',
		sendWarning: (warning) => {
			sent.push(warning);
			return Promise.resolve(sendOk);
		},
		warningDays: WARNING_DAYS
	});
}

beforeEach(() => {
	fixture = creditsFixture(START);
	userId = fixture.addUser('usr_caduca');
	fixture.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-caduca' });
	sent = [];
	sendOk = true;
});

afterEach(() => {
	fixture.close();
});

describe('tarea de caducidad del saldo gratuito (T330)', () => {
	it('un único aviso por bolsa aunque la tarea corra cada hora dentro de la ventana, y después la caducidad con su movimiento', async () => {
		// La bolsa caduca a los 30 días: la ventana de 7 días empieza al día 23.
		fixture.clock.advance(22 * DAY + 23 * HOUR);
		expect(await run()).toBe(0);
		expect(sent).toHaveLength(0);

		fixture.clock.advance(HOUR);
		expect(await run()).toBe(0);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			reason: 'free_expiry_warning',
			to: 'cuenta@ejemplo.es',
			expiry: { days: WARNING_DAYS }
		});

		// Cambios de hora y de día con la bolsa todavía vigente: ningún aviso nuevo.
		for (let hour = 0; hour < 24 * 5; hour += 1) {
			fixture.clock.advance(HOUR);
			await run();
		}
		expect(sent).toHaveLength(1);
		expect(fixture.credits.getBalance(userId).freeMicro).toBeGreaterThan(0);

		// Al cumplirse los 30 días, la tarea caduca la bolsa.
		fixture.clock.advance(3 * DAY);
		expect(await run()).toBe(1);
		expect(fixture.credits.getBalance(userId).freeMicro).toBe(0);
		expect(sent).toHaveLength(1);

		const expiry = movementsPage(fixture.deps, {
			userId,
			fromMs: null,
			toMs: null,
			appId: null,
			page: 1
		});
		expect(expiry.rows.map((row) => row.type)).toContain('expiry');
		expect(
			eventsNamed(fixture.logger, 'credits.expiry.applied').map((event) => event.fields)
		).toEqual([{ count: 1 }]);
	});

	it('un fallo de envío no detiene la caducidad y el aviso no se repite después', async () => {
		sendOk = false;
		fixture.clock.advance(23 * DAY);
		await run();
		expect(sent).toHaveLength(1);

		fixture.clock.advance(8 * DAY);
		expect(await run()).toBe(1);
		expect(fixture.credits.getBalance(userId).freeMicro).toBe(0);
		expect(sent).toHaveLength(1);
	});
});
