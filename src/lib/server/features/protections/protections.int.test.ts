// Protecciones contra SQLite real (BE-FR-43, BE-FR-46 CA1–CA2, FR-069, FR-072; T196–T203): freno global con su estado
// guardado, aviso único al administrador, cuentas con compra real exentas, corte del día de Madrid, liberación manual con
// auditoría, frecuencia por minuto con Retry-After y ranuras de transcripción liberadas.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { adminAudit } from '$lib/server/features/audit/schema';
import { userBalances } from '$lib/server/features/credits/schema';
import { updateSetting } from '$lib/server/features/apps';
import { createIdGenerator } from '$lib/server/shared/ids';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import {
	createProtectionsRuntime,
	guardRequest,
	releaseBrake,
	type ProtectionsDeps,
	type RequestGuardInput
} from './index';
import { protectionState } from './schema';

// 6 USD de coste real a 0,92 EUR por USD son 552 céntimos: por encima de los 500 del freno.
const OVER_BRAKE_COST_MICRO_USD = 6_000_000;
const DAY_START = Date.UTC(2026, 9, 11, 8, 0, 0);
// La app sembrada exige 4.0.0 (`apps/seed.ts`): sin versión válida la petición ni llega al freno.
const SEEDED_MIN_VERSION = '4.0.0';

let fixture: CreditsFixture;
let sender: FakeEmailSender;
let costs: { userId: string; costMicroUsd: number }[];
let costCalls: number;

beforeEach(() => {
	fixture = creditsFixture(DAY_START);
	sender = createFakeEmailSender();
	costs = [];
	costCalls = 0;
});

afterEach(() => {
	fixture.close();
});

function protectionsDeps(): ProtectionsDeps {
	return {
		db: fixture.db,
		clock: fixture.clock,
		logger: fixture.logger,
		apps: {
			db: fixture.db,
			logger: fixture.logger,
			clock: fixture.clock,
			ids: createIdGenerator()
		},
		credits: fixture.credits,
		alerts: {
			db: fixture.db,
			logger: fixture.logger,
			clock: fixture.clock,
			sender,
			adminEmail: () => 'admin@example.test',
			supportEmail: () => 'soporte@example.test'
		},
		dailyCosts: {
			costByUserOfDay: () => {
				costCalls += 1;
				return costs;
			}
		},
		runtime: createProtectionsRuntime()
	};
}

/** Adaptador de prueba: el guard es síncrono; aquí se espera como promesa para leer rechazos y aceptaciones igual. */
function guard(deps: ProtectionsDeps, input: RequestGuardInput): Promise<() => void> {
	return new Promise((resolve, reject) => {
		try {
			resolve(guardRequest(deps, input));
		} catch (error) {
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

function requestFor(userId: string, overrides: Partial<RequestGuardInput> = {}): RequestGuardInput {
	return {
		endpoint: 'ai',
		appId: SEEDED_APP_ID,
		appVersion: SEEDED_MIN_VERSION,
		userId,
		transcription: false,
		...overrides
	};
}

function brakeRow() {
	return fixture.db
		.select()
		.from(protectionState)
		.where(eq(protectionState.key, 'global_brake'))
		.get();
}

describe('freno global de gasto (BE-FR-46 CA1)', () => {
	it('al superar el límite del día se activa, se guarda, avisa una vez al administrador y rechaza', async () => {
		const deps = protectionsDeps();
		fixture.addUser('usr_a');
		costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];

		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		expect(brakeRow()?.value).toMatchObject({ day: '2026-10-11', active: true, releasedAt: null });
		expect(sender.sent).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'protections.brake.activated')).toHaveLength(1);
	});

	it('mientras está activo rechaza sin volver a sumar el día ni avisar otra vez', async () => {
		const deps = protectionsDeps();
		fixture.addUser('usr_a');
		costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		expect(costCalls).toBe(1);
		expect(sender.sent).toHaveLength(1);
	});

	it('el coste de las cuentas con compra real no cuenta para el freno (BE-FR-46 CA1)', async () => {
		const deps = protectionsDeps();
		fixture.credits.grantWelcome({
			userId: fixture.addUser('usr_pagadora'),
			emailNormalizedHash: 'h-pagadora'
		});
		fixture.db
			.update(userBalances)
			.set({ hasRealPurchase: true })
			.where(eq(userBalances.userId, 'usr_pagadora'))
			.run();
		costs = [{ userId: 'usr_pagadora', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];

		await expect(guard(deps, requestFor('usr_pagadora'))).resolves.toBeTypeOf('function');

		expect(brakeRow()).toBeUndefined();
		expect(sender.sent).toHaveLength(0);
	});

	it('al cambiar de día del calendario de Madrid vuelve a estar libre', async () => {
		const deps = protectionsDeps();
		fixture.addUser('usr_a');
		costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		// 2026-10-11 22:30 UTC es 00:30 del 12 en Madrid: día nuevo, sin coste.
		fixture.clock.set(Date.UTC(2026, 9, 11, 22, 30, 0));
		costs = [];

		await expect(guard(deps, requestFor('usr_a'))).resolves.toBeTypeOf('function');
	});

	it('la liberación manual deja auditoría, no vuelve a saltar ese día y solo se puede liberar una vez', async () => {
		const deps = protectionsDeps();
		fixture.addUser('usr_a');
		const adminId = fixture.addUser('adm_a', 'admin');
		costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});
		const releaseDeps = {
			db: fixture.db,
			clock: fixture.clock,
			logger: fixture.logger,
			audit: { clock: fixture.clock, ids: createIdGenerator(), logger: fixture.logger }
		};

		expect(releaseBrake(releaseDeps, adminId)).toBe(true);
		expect(releaseBrake(releaseDeps, adminId)).toBe(false);

		expect(brakeRow()?.value).toMatchObject({ active: false, releasedBy: adminId });
		expect(
			fixture.db
				.select()
				.from(adminAudit)
				.where(eq(adminAudit.action, 'protections.brake.released'))
				.all()
		).toHaveLength(1);
		await expect(guard(deps, requestFor('usr_a'))).resolves.toBeTypeOf('function');
	});
});

describe('frecuencia por minuto (BE-FR-43)', () => {
	it('la petición 31 del mismo minuto se rechaza con RATE_LIMITED y Retry-After; un minuto después vuelve a pasar', async () => {
		const deps = protectionsDeps();
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
		const deps = protectionsDeps();
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
		const deps = protectionsDeps();
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
		const deps = protectionsDeps();
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
