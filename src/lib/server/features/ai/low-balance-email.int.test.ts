// Aviso de saldo bajo por email (T254; BE-FR-49.7) contra SQLite real: un solo envío al cruzar el umbral, con la dirección de la
// cuenta y sin enlace; ninguno si la cuenta no tiene email o no hay dependencias de notificación.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { toEpochMs } from '$lib/shared/time';
import { notifyLowBalance } from './service';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let sender: FakeEmailSender;
let userId: string;

beforeEach(() => {
	f = creditsFixture(NOW);
	sender = createFakeEmailSender();
	userId = f.addUser('usr_aviso_correo');
});

afterEach(() => {
	f.close();
});

function notifications() {
	return {
		sender,
		logger: f.logger,
		supportEmail: () => 'soporte@ejemplo.es'
	};
}

describe('notifyLowBalance (BE-FR-49.7)', () => {
	it('envía un correo a la cuenta, sin enlace', async () => {
		await notifyLowBalance({ db: f.db, notifications: notifications() }, userId, toEpochMs(NOW));

		expect(sender.sent).toHaveLength(1);
		expect(sender.sent[0]?.to).toBe(`${userId}@ejemplo.es`);
		expect(sender.sent[0]?.text).not.toMatch(/https?:\/\//);
	});

	it('sin dependencias de notificación no envía nada', async () => {
		await notifyLowBalance({ db: f.db }, userId, toEpochMs(NOW));

		expect(sender.sent).toEqual([]);
	});

	it('si la cuenta no existe, no envía nada', async () => {
		await notifyLowBalance(
			{ db: f.db, notifications: notifications() },
			'usr_no_existe',
			toEpochMs(NOW)
		);

		expect(sender.sent).toEqual([]);
	});
});
