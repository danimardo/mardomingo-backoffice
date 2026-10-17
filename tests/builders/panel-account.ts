// Cuenta del panel con datos de todos los tipos (T250; Historias 15.22): bolsas gratuita, comprada y simulada, una reserva
// abierta, deuda, movimientos de los tipos de la web, operaciones de IA en sus estados y un perfil fiscal. Todo se crea con
// los servicios de cada funcionalidad, con semilla fija y reloj falso. Las sesiones y el documento legal pendiente quedan
// fuera de este montaje (se añaden con sus propias funcionalidades en L12–L13).
import { eq } from 'drizzle-orm';
import { insertInFlightOperation } from './ai-operations';
import { aiOperations } from '$lib/server/features/ai/schema';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';
import { toEpochMs } from '$lib/shared/time';
import { markRealPurchase } from './purchases';
import { paymentsFixture, type PaymentsFixture } from './payments';

export const PANEL_USER = {
	kind: 'individual',
	taxId: '12345678Z',
	legalName: 'Ana Pérez',
	address: 'Calle Mayor 1',
	postalCode: '28013',
	city: 'Madrid',
	country: 'ES'
};

const CREDIT = 1_000_000;

export interface PanelAccount {
	readonly fixture: PaymentsFixture;
	readonly userId: string;
	readonly paymentId: string;
	readonly simulatedPaymentId: string;
}

/** Cuenta con todos los datos del panel. Usa un reloj fijo, una semilla fija y la base de datos de la plantilla. */
export function panelAccountFixture(): PanelAccount {
	const fixture = paymentsFixture('test');
	const { credits, db } = fixture.base;
	const { userId, waiverId } = fixture.addAccount('usr_panel');

	// Bolsa gratuita de bienvenida.
	credits.grantWelcome({ userId, emailNormalizedHash: 'hash-panel' });

	// Primera compra. En la v4 el proveedor es el simulado; la marca de compra real se fija aparte (ver abajo).
	const real = fixture.payments.purchase({
		userId,
		role: 'user',
		attemptId: 'att_panel_real',
		packId: 'pck_seed_10eur',
		wantsFullInvoice: false,
		withdrawalAcceptanceId: waiverId
	});
	if (real.status !== 'completed') throw new Error('la compra real debía completarse');
	markRealPurchase(db, userId);

	// Compra simulada: bolsa paid marcada como simulada, sin contar como compra real.
	const simulated = fixture.payments.purchase({
		userId,
		role: 'user',
		attemptId: 'att_panel_simulada',
		packId: 'pck_seed_5eur',
		wantsFullInvoice: false,
		withdrawalAcceptanceId: waiverId
	});
	if (simulated.status !== 'completed') throw new Error('la compra simulada debía completarse');

	// Operaciones de IA en sus estados: cada una pasa por la reserva y el cobro, o queda como el estado pide.
	const statuses = ['ok', 'provider_error', 'cancelled', 'undelivered', 'interrupted'] as const;
	for (const status of statuses) {
		const operationId = insertInFlightOperation(db, { userId, appId: SEEDED_APP_ID });
		db.update(aiOperations)
			.set({ status, completedAt: toEpochMs(fixture.base.clock.now()) })
			.where(eq(aiOperations.id, operationId))
			.run();
	}

	// Reserva abierta (saldo reservado), y después un cobro que supera el disponible en 50 créditos: esa diferencia es deuda.
	credits.reserve({
		userId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(db, { userId }),
		amountMicro: 2 * CREDIT
	});
	const total = credits.getBalance(userId).totalMicro;
	const charged = credits.reserve({
		userId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(db, { userId }),
		amountMicro: credits.getBalance(userId).availableMicro
	});
	if (!charged.ok) throw new Error('la reserva del disponible debía caber');
	credits.chargeAndRelease({ holdId: charged.holdId, realCostMicro: total + 50 * CREDIT });

	// Perfil fiscal para la factura completa del panel.
	const saved = fixture.deps.invoicing.saveBillingProfile({ userId, profile: PANEL_USER });
	if (saved.status !== 'saved')
		throw new Error(`el perfil fiscal debía guardarse: ${saved.reason}`);

	return { fixture, userId, paymentId: real.paymentId, simulatedPaymentId: simulated.paymentId };
}
