// Builders de `apps` para las pruebas de integración (T083). Las altas van por la API pública de `apps/index.ts`;
// solo el administrador de prueba se inserta directamente, porque la auditoría exige que exista (FK de `admin_audit`).
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { user } from '$lib/server/features/accounts/schema';
import {
	createApp,
	createOperation,
	type AppsDeps,
	type NewApp,
	type NewOperation
} from '$lib/server/features/apps';
import { createIdGenerator } from '$lib/server/shared/ids';
import { toCivilDate, toEpochMs, type EpochMs } from '$lib/shared/time';
import { seededRandomBytes } from './ids';
import { createFakeLogger, type FakeLogger } from './fake-logger';

/** Instante fijo de las pruebas (2026-10-25 22:00 UTC, medianoche de Madrid). */
export const TEST_NOW: EpochMs = toEpochMs(1_792_879_200_000);

export function fixedClock(now: EpochMs = TEST_NOW): Clock {
	return {
		now: () => now,
		today: () => toCivilDate('2026-10-25')
	};
}

export interface AppsTestContext {
	readonly deps: AppsDeps;
	readonly logger: FakeLogger;
	readonly adminId: string;
}

/** Inserta el administrador de prueba (la auditoría lo referencia). Solo puede haber uno: FR-017. */
export function insertAdmin(db: Db): string {
	const id = 'usr_admin_test';
	db.insert(user)
		.values({
			id,
			email: 'admin@example.test',
			emailVerified: true,
			role: 'admin',
			createdAt: TEST_NOW,
			updatedAt: TEST_NOW
		})
		.run();
	return id;
}

export function appsTestContext(db: Db, seed = 11): AppsTestContext {
	const logger = createFakeLogger();
	const deps: AppsDeps = {
		db,
		logger,
		clock: fixedClock(),
		ids: createIdGenerator(seededRandomBytes(seed))
	};
	return { deps, logger, adminId: insertAdmin(db) };
}

/** Segunda app, distinta de `secretario`, para los tests de aislamiento entre apps. */
export const SECOND_APP: NewApp = {
	slug: 'otra-app',
	name: 'Otra app',
	description: 'App de prueba para el aislamiento',
	clientTypes: ['web'],
	links: { landing: { type: 'internal' } },
	syncSchema: { categories: { notas: { strategy: 'block' } } },
	allowedOrigins: ['https://otra.mardomingo.com']
};

export function addSecondApp(ctx: AppsTestContext, overrides: Partial<NewApp> = {}): string {
	return createApp(ctx.deps, ctx.adminId, { ...SECOND_APP, ...overrides });
}

/** Operación de chat activa con modelo, lista para usarse en una petición. */
export function chatOperation(key: string, overrides: Partial<NewOperation> = {}): NewOperation {
	return {
		key,
		name: `Operación ${key}`,
		kind: 'chat',
		model: 'modelo-a',
		maxOutputTokens: 1024,
		maxCostMicro: 1_000_000,
		timeoutMs: 45_000,
		capabilities: { image_input: false, structured_output: false, tools: false },
		active: true,
		...overrides
	};
}

export function addOperation(ctx: AppsTestContext, appId: string, input: NewOperation): string {
	return createOperation(ctx.deps, ctx.adminId, appId, input);
}
