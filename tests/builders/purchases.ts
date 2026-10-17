// Cuentas con y sin compra real para las pruebas (T206), y compras completadas para las de `credits` (T232). Una compra real
// deja `has_real_purchase` a verdadero en el saldo; la compra simulada (solo testers, L10) no lo cambia. Requiere que la
// cuenta ya tenga fila de saldo (bienvenida) cuando se usa `markRealPurchase`.
import { eq } from 'drizzle-orm';
import { termsAcceptances } from '$lib/server/features/legal/schema';
import { packs, payments } from '$lib/server/features/payments/schema';
import { userBalances } from '$lib/server/features/credits/schema';
import { toEurCents, toMicro, toPpm } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import type { TestDatabase } from './database';

/** Marca la cuenta como cliente con compra real (BE-FR-11 CA2): queda exenta del tope diario y del freno. */
export function markRealPurchase(db: TestDatabase['db'], userId: string): void {
	db.update(userBalances)
		.set({ hasRealPurchase: true })
		.where(eq(userBalances.userId, userId))
		.run();
}

export interface CompletedPurchaseInput {
	readonly paymentId: string;
	readonly userId: string;
	readonly creditsMicro: number;
	readonly simulated: boolean;
	readonly now: number;
}

/**
 * Inserta una compra completada (pack, aceptación de la renuncia y pago) para que una bolsa `purchase` pueda apuntar a
 * ella por clave foránea. Importe fijo de 10 € con IVA 21 % (BE-FR-25 CA5).
 */
export function insertCompletedPurchase(
	db: TestDatabase['db'],
	input: CompletedPurchaseInput
): void {
	const now = toEpochMs(input.now);
	const packId = `pck_${input.paymentId}`;
	const acceptanceId = `acc_${input.paymentId}`;
	db.insert(packs)
		.values({
			id: packId,
			name: `Pack de prueba ${input.paymentId}`,
			priceEurCents: toEurCents(1000),
			bonusPpm: toPpm(0),
			active: true,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now
		})
		.run();
	db.insert(termsAcceptances)
		.values({
			id: acceptanceId,
			userId: input.userId,
			document: 'withdrawal_waiver',
			version: '1',
			acceptedAt: now
		})
		.run();
	db.insert(payments)
		.values({
			id: input.paymentId,
			userId: input.userId,
			packId,
			attemptId: `att_${input.paymentId}`,
			provider: input.simulated ? 'simulated' : 'stripe',
			providerRef: `prov_${input.paymentId}`,
			status: 'completed',
			amountEurCents: toEurCents(1000),
			baseEurCents: toEurCents(826),
			vatEurCents: toEurCents(174),
			vatRatePpm: toPpm(210_000),
			country: 'ES',
			creditsMicro: toMicro(input.creditsMicro),
			wantsFullInvoice: false,
			simulated: input.simulated,
			withdrawalAcceptanceId: acceptanceId,
			createdAt: now,
			completedAt: now,
			updatedAt: now
		})
		.run();
}
