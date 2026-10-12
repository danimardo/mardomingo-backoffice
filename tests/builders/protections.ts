// Arnés de `protections` para las pruebas de integración (T206, T207): dependencias sobre el montaje de créditos, un puerto
// de coste diario que la prueba cambia a mano y un adaptador que espera el guard síncrono como promesa.
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import {
	createProtectionsRuntime,
	guardRequest,
	type ProtectionsDeps,
	type RequestGuardInput
} from '$lib/server/features/protections';
import { createIdGenerator } from '$lib/server/shared/ids';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';
import type { CreditsFixture } from './credits';

/** La app sembrada exige 4.0.0 (`apps/seed.ts`): sin versión válida la petición ni llega al freno. */
export const SEEDED_MIN_VERSION = '4.0.0';
/** 6 USD de coste real a 0,92 EUR por USD son 552 céntimos: por encima de los 500 del freno. */
export const OVER_BRAKE_COST_MICRO_USD = 6_000_000;

export interface ProtectionsHarness {
	readonly deps: ProtectionsDeps;
	readonly sender: FakeEmailSender;
	/** Coste real por cuenta que devuelve el puerto diario; la prueba lo cambia entre peticiones. */
	costs: { userId: string; costMicroUsd: number }[];
	/** Veces que el guard ha pedido el coste diario. */
	costCalls(): number;
}

export function protectionsHarness(fixture: CreditsFixture): ProtectionsHarness {
	const sender = createFakeEmailSender();
	let calls = 0;
	const harness: ProtectionsHarness = {
		sender,
		costs: [],
		costCalls: () => calls,
		deps: {
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
					calls += 1;
					return harness.costs;
				}
			},
			runtime: createProtectionsRuntime()
		}
	};
	return harness;
}

/** El guard es síncrono; aquí se espera como promesa para leer rechazos y aceptaciones de la misma forma. */
export function guard(deps: ProtectionsDeps, input: RequestGuardInput): Promise<() => void> {
	return new Promise((resolve, reject) => {
		try {
			resolve(guardRequest(deps, input));
		} catch (error) {
			reject(error instanceof Error ? error : new Error(String(error)));
		}
	});
}

export function requestFor(
	userId: string,
	overrides: Partial<RequestGuardInput> = {}
): RequestGuardInput {
	return {
		endpoint: 'ai',
		appId: SEEDED_APP_ID,
		appVersion: SEEDED_MIN_VERSION,
		userId,
		transcription: false,
		...overrides
	};
}
