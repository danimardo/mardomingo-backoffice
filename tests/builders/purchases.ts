// Cuentas con y sin compra real para las pruebas (T206). Una compra real deja `has_real_purchase` a verdadero en el saldo;
// la compra simulada (solo testers, L10) no lo cambia. Requiere que la cuenta ya tenga fila de saldo (bienvenida).
import { eq } from 'drizzle-orm';
import { userBalances } from '$lib/server/features/credits/schema';
import type { TestDatabase } from './database';

/** Marca la cuenta como cliente con compra real (BE-FR-11 CA2): queda exenta del tope diario y del freno. */
export function markRealPurchase(db: TestDatabase['db'], userId: string): void {
	db.update(userBalances)
		.set({ hasRealPurchase: true })
		.where(eq(userBalances.userId, userId))
		.run();
}
