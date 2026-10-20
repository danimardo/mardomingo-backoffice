// Tarea `disposable-domains` contra SQLite real y el simulador de la lista (BE-FR-11.2, FR-019; T340): una lista válida añade
// sus dominios y el registro lo usa; una lista corta, una caída o un 503 no cambian nada y se registra el fallo.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BLOCKLIST_PATH, startBlocklistMock } from '../../../../tests/mock-servers/blocklist';
import type { MockServer } from '../../../../tests/mock-servers/server';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { eventsNamed } from '../../../../tests/builders/fake-logger';
import { isDisposableDomain } from '$lib/server/features/accounts/repository';
import { runDisposableDomains } from './disposable-domains';

let mock: MockServer;
let f: CreditsFixture;

beforeAll(async () => {
	mock = await startBlocklistMock();
});

afterAll(async () => {
	await mock.close();
});

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 20, 9, 0, 0));
});

afterEach(() => {
	f.close();
});

const run = () =>
	runDisposableDomains({
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		url: `${mock.url}${BLOCKLIST_PATH}`
	});

describe('lista de dominios desechables (T340)', () => {
	it('una lista válida añade sus dominios y el registro los bloquea', async () => {
		mock.scenario('ok');

		expect(await run()).toBe(120);
		expect(isDisposableDomain(f.db, 'desechable7.example')).toBe(true);
		expect(
			eventsNamed(f.logger, 'accounts.disposable_domains.refreshed').map((event) => event.fields)
		).toEqual([{ count: 120 }]);
	});

	it('una lista corta no se usa: no añade nada y deja el fallo registrado', async () => {
		mock.scenario('short');

		expect(await run()).toBe(0);
		expect(isDisposableDomain(f.db, 'desechable1.example')).toBe(false);
		expect(eventsNamed(f.logger, 'accounts.disposable_domains.refresh_failed')).toHaveLength(1);
	});

	it('una caída del proveedor conserva lo que ya estaba', async () => {
		mock.scenario('ok');
		await run();
		mock.scenario('down');

		expect(await run()).toBe(0);
		expect(isDisposableDomain(f.db, 'desechable7.example')).toBe(true);
		expect(
			eventsNamed(f.logger, 'accounts.disposable_domains.refresh_failed').at(-1)?.fields
		).toEqual({
			httpStatus: 503
		});
		mock.scenario('ok');
	});
});
