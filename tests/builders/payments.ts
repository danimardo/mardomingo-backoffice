// Montaje de `payments` para las pruebas de integración (T234, T235): la base de datos de créditos, el proveedor de pagos doble,
// la facturación doble y el servicio ya creado. Las cuentas se crean con su rol y su renuncia de desistimiento vigente.
import { createFakeInvoicing } from '$lib/server/adapters/invoicing/fake';
import {
	createFakePaymentsProvider,
	type FakePaymentsProvider
} from '$lib/server/adapters/payments/fake';
import type { AppEnv } from '$lib/server/config/env-schema';
import { currentVersions, recordWithdrawalWaiver } from '$lib/server/features/legal';
import { toEpochMs } from '$lib/shared/time';
import { createInvoicingService } from '$lib/server/features/invoicing';
import {
	createPaymentsService,
	type PaymentsDeps,
	type PaymentsService
} from '$lib/server/features/payments';
import { createIdGenerator } from '$lib/server/shared/ids';
import { creditsFixture, type CreditsFixture } from './credits';
import { seededRandomBytes } from './ids';

export interface PaymentsFixture {
	readonly base: CreditsFixture;
	readonly provider: FakePaymentsProvider;
	readonly payments: PaymentsService;
	readonly deps: PaymentsDeps;
	/** Cuenta con su rol y una renuncia de desistimiento vigente. Devuelve el id de la cuenta y el de la renuncia. */
	addAccount(id: string, role?: string): { readonly userId: string; readonly waiverId: string };
	close(): void;
}

export function paymentsFixture(
	appEnv: AppEnv = 'test',
	start: number = Date.now()
): PaymentsFixture {
	const base = creditsFixture(start);
	const { db, logger, clock } = base;
	const ids = createIdGenerator(seededRandomBytes(53));
	const provider = createFakePaymentsProvider();
	const invoicing = createInvoicingService({
		db,
		logger,
		clock,
		ids,
		provider: createFakeInvoicing()
	});
	const deps: PaymentsDeps = {
		db,
		logger,
		clock,
		ids,
		appEnv,
		apps: { db, logger, clock, ids },
		provider,
		credits: base.credits,
		invoicing,
		legal: { db, logger, ids },
		auditDeps: { clock, ids, logger }
	};
	return {
		base,
		provider,
		payments: createPaymentsService(deps),
		deps,
		addAccount(id, role = 'user') {
			const userId = base.addUser(id, role);
			const now = toEpochMs(clock.now());
			const current = currentVersions(deps.legal, now, ['withdrawal_waiver']).get(
				'withdrawal_waiver'
			);
			if (current === undefined) throw new Error('la renuncia debía estar sembrada');
			const waiverId = recordWithdrawalWaiver(deps.legal, {
				userId,
				appId: null,
				ip: null,
				now,
				version: current.version
			});
			return { userId, waiverId };
		},
		close() {
			base.close();
		}
	};
}
