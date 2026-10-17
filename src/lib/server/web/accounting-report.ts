// Informe contable de un periodo para W50–W51 (BE-FR-76; T316). Reúne las compras de `payments`, el coste de IA de `ai` convertido con
// el tipo de cada operación (`pricing`) y lo entrega a `invoicing` para el CSV. Solo compone lecturas públicas.
import type { Composition } from '$lib/server/composition';
import { operationCostFactsBetween } from '$lib/server/features/ai';
import type { AccountingExport } from '$lib/server/features/invoicing';
import { usdEurPpmOf } from '$lib/server/features/pricing';
import { aiCostsInEur } from './accounting-costs';

export interface AccountingReport {
	readonly export: AccountingExport;
	/** Operaciones con coste sin tipo de cambio conocido: el informe lo dice y no suma euros por ellas. */
	readonly unconverted: number;
	/** Compras del periodo (incluidas las simuladas, que no son ingresos). */
	readonly purchases: number;
}

export function accountingReport(
	composition: Composition,
	period: { readonly fromMs: number; readonly toMs: number }
): AccountingReport {
	const payments = composition.payments.paymentFactsBetween(period);
	const { costs, unconverted } = aiCostsInEur(
		operationCostFactsBetween(composition.db, period),
		(fxRateId) => usdEurPpmOf(composition.pricing, fxRateId)
	);
	return {
		export: composition.invoicing.accountingExport({ payments, aiCosts: costs }),
		unconverted,
		purchases: payments.length
	};
}
