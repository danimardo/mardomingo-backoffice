// Aceptación SC-019 (T342; BE-FR-56): para cada una de las ocho alertas de log-events §4, una condición sostenida durante varias
// ejecuciones envía un solo email; tras normalizarse y volver a cruzar, envía uno más. Contra SQLite real y un emisor falso.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { alertKeys, type AlertKey } from './domain/alert-state';
import { clearAlert, raiseAlert, type AlertDeps } from './alerts';

let f: CreditsFixture;
let sender: FakeEmailSender;
let deps: AlertDeps;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 20, 9, 0, 0));
	sender = createFakeEmailSender();
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		sender,
		adminEmail: () => 'admin@mardomingo.test',
		supportEmail: () => 'soporte@mardomingo.test'
	};
});

afterEach(() => {
	f.close();
});

const ALERTS: readonly { readonly name: string; readonly key: AlertKey }[] = [
	{ name: 'tipo de cambio desactualizado', key: alertKeys.fxStale() },
	{ name: 'modelo retirado', key: alertKeys.modelRetired('modelo-a') },
	{ name: 'precio de modelo cambiado', key: alertKeys.modelPrice('modelo-a') },
	{ name: 'operación marcada', key: alertKeys.flagged('usr_1', '2026-10-20') },
	{ name: 'freno global', key: alertKeys.globalBrake('2026-10-20') },
	{ name: 'discrepancia del ledger', key: alertKeys.ledgerMismatch('usr_1') },
	{ name: 'saldo de OpenRouter bajo', key: alertKeys.openrouterBalance() },
	{ name: 'error de facturación de Mistral', key: alertKeys.mistralBilling() }
];

describe('alertas: un email por cruce (SC-019, T342)', () => {
	for (const alert of ALERTS) {
		it(`${alert.name}: una condición sostenida envía un solo email; al normalizarse y volver a cruzar, otro`, async () => {
			await raiseAlert(deps, { key: alert.key, detail: 'primera lectura' });
			await raiseAlert(deps, { key: alert.key, detail: 'segunda lectura' });
			await raiseAlert(deps, { key: alert.key, detail: 'tercera lectura' });
			expect(sender.sent).toHaveLength(1);

			clearAlert(deps, alert.key);
			await raiseAlert(deps, { key: alert.key, detail: 'vuelve a cruzar' });
			expect(sender.sent).toHaveLength(2);
		});
	}
});
