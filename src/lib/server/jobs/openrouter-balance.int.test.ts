// Tarea `openrouter-balance` contra SQLite real (T326): por debajo del umbral levanta la alerta `openrouter_balance` una sola vez;
// al recuperar el saldo la limpia; y si el proveedor no responde no cambia nada.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeAiGateway } from '$lib/server/adapters/openrouter/fake';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { eventsNamed } from '../../../../tests/builders/fake-logger';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import { clearAlert, raiseAlert, type AlertDeps } from '$lib/server/features/notifications/alerts';
import { activeAlerts } from '$lib/server/features/notifications/alerts-read';
import { alertKeys } from '$lib/server/features/notifications/domain/alert-state';
import { runOpenRouterBalance } from './openrouter-balance';

const UMBRAL = 10_000_000;
let f: CreditsFixture;
let deps: AlertDeps;
let gateway: ReturnType<typeof createFakeAiGateway>;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 20, 9, 0, 0));
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		sender: createFakeEmailSender(),
		adminEmail: () => 'admin@mardomingo.test',
		supportEmail: () => 'soporte@mardomingo.test'
	};
	gateway = createFakeAiGateway();
});

afterEach(() => {
	f.close();
});

const run = () => runOpenRouterBalance({ gateway, thresholdMicroUsd: UMBRAL, alerts: deps });

describe('tarea openrouter-balance (T326)', () => {
	it('con saldo por debajo del umbral levanta la alerta una sola vez', async () => {
		gateway.setCreditsBalance(3_000_000);

		expect(await run()).toBe('alert');
		expect(await run()).toBe('alert');

		expect(activeAlerts(f.db).map((alert) => alert.key)).toEqual(['openrouter_balance']);
		expect(eventsNamed(f.logger, 'notifications.alert.triggered')).toHaveLength(1);
		expect(eventsNamed(f.logger, 'notifications.alert.suppressed')).toHaveLength(1);
	});

	it('al recuperar el saldo limpia la alerta y la rearma', async () => {
		gateway.setCreditsBalance(3_000_000);
		await run();

		gateway.setCreditsBalance(50_000_000);
		expect(await run()).toBe('clear');

		expect(activeAlerts(f.db)).toEqual([]);
		expect(eventsNamed(f.logger, 'notifications.alert.rearmed')).toHaveLength(1);
	});

	it('si el proveedor no responde no levanta ni limpia nada', async () => {
		await raiseAlert(deps, { key: alertKeys.openrouterBalance(), detail: 'previa' });
		gateway.setCreditsBalance(null);

		expect(await run()).toBe('unavailable');

		expect(activeAlerts(f.db).map((alert) => alert.key)).toEqual(['openrouter_balance']);
		clearAlert(deps, alertKeys.openrouterBalance());
	});
});
