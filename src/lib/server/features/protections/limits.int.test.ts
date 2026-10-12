// Límites de frecuencia, ranuras de transcripción y mantenimiento en el guard de IA contra SQLite real (BE-FR-43, BE-FR-47
// CA2; T197, T202, T207): 31.ª petición del minuto con Retry-After, límite de la app antes que el de la cuenta, ranura
// liberada al terminar, y mantenimiento con el texto del administrador.
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { updateSetting } from '$lib/server/features/apps';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	guard,
	protectionsHarness,
	requestFor,
	type ProtectionsHarness
} from '../../../../../tests/builders/protections';

const DAY_START = Date.UTC(2026, 9, 11, 8, 0, 0);

let fixture: CreditsFixture;
let harness: ProtectionsHarness;

beforeEach(() => {
	fixture = creditsFixture(DAY_START);
	harness = protectionsHarness(fixture);
});

afterEach(() => {
	fixture.close();
});

describe('frecuencia por minuto (BE-FR-43)', () => {
	it('la petición 31 del mismo minuto se rechaza con RATE_LIMITED y Retry-After; un minuto después vuelve a pasar', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		for (let i = 0; i < 30; i += 1) {
			await guard(deps, requestFor('usr_a'));
		}

		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			details: { retryAfterSeconds: 60 }
		});
		expect(eventsNamed(fixture.logger, 'protections.request.rejected').at(-1)?.fields).toEqual({
			reason: 'rate_limited_account'
		});

		fixture.clock.advance(60_000);
		await expect(guard(deps, requestFor('usr_a'))).resolves.toBeTypeOf('function');
	});

	it('el límite de una cuenta no afecta a otra', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		fixture.addUser('usr_b');
		for (let i = 0; i < 30; i += 1) {
			await guard(deps, requestFor('usr_a'));
		}

		await expect(guard(deps, requestFor('usr_b'))).resolves.toBeTypeOf('function');
	});
});

describe('ranuras de transcripción (BE-FR-43)', () => {
	it('con las dos ranuras de la app ocupadas, la tercera responde RATE_LIMITED con 5 s; al liberar una pasa', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		const first = await guard(deps, requestFor('usr_a', { transcription: true }));
		await guard(deps, requestFor('usr_a', { transcription: true }));

		await expect(guard(deps, requestFor('usr_a', { transcription: true }))).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			details: { retryAfterSeconds: 5 }
		});
		expect(eventsNamed(fixture.logger, 'protections.request.rejected').at(-1)?.fields).toEqual({
			reason: 'concurrency_account'
		});

		first();
		first();
		await expect(guard(deps, requestFor('usr_a', { transcription: true }))).resolves.toBeTypeOf(
			'function'
		);
	});
});

describe('mantenimiento en las rutas de IA (BE-FR-47 CA2)', () => {
	it('con mantenimiento activo, la petición responde MAINTENANCE con el texto del administrador; al desactivarlo vuelve a pasar', async () => {
		const deps = harness.deps;
		const userId = fixture.addUser('usr_a');
		const adminId = fixture.addUser('adm_mant', 'admin');
		updateSetting(deps.apps, {
			actorId: adminId,
			key: 'maintenance',
			value: { active: true, message: 'Volvemos a las 18:00' },
			reason: 'prueba de mantenimiento'
		});

		await expect(guard(deps, requestFor(userId))).rejects.toMatchObject({
			code: 'MAINTENANCE',
			details: { message: 'Volvemos a las 18:00' }
		});

		updateSetting(deps.apps, {
			actorId: adminId,
			key: 'maintenance',
			value: { active: false, message: '' },
			reason: 'fin de la prueba de mantenimiento'
		});

		await expect(guard(deps, requestFor(userId))).resolves.toBeTypeOf('function');
	});
});
