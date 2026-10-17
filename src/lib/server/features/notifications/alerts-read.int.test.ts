// Lectura de las alertas activas (W33; T304) contra SQLite real: una alerta levantada aparece como activa y deja de aparecer al
// limpiarla. Usa el mismo estado que escribe el sistema de alertas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import { alertKeys } from './domain/alert-state';
import { clearAlert, raiseAlert, type AlertDeps } from './alerts';
import { activeAlerts } from './alerts-read';

let f: CreditsFixture;
let deps: AlertDeps;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		sender: createFakeEmailSender(),
		adminEmail: () => 'admin@mardomingo.test',
		supportEmail: () => 'soporte@mardomingo.test'
	};
});

afterEach(() => {
	f.close();
});

describe('alertas activas (W33)', () => {
	it('una alerta levantada aparece como activa y deja de aparecer al limpiarla', async () => {
		await raiseAlert(deps, { key: alertKeys.fxStale(), detail: 'el BCE no responde' });
		expect(activeAlerts(f.db).map((alert) => alert.key)).toEqual(['fx_stale']);

		clearAlert(deps, alertKeys.fxStale());
		expect(activeAlerts(f.db)).toEqual([]);
	});
});
