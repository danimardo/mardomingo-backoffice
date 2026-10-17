// Filas de la exportación contable (BE-FR-76; T240). Puro: los hechos de pago y de coste de IA llegan por parámetro (`payments`
// y `ai` no se leen desde aquí, ARCHITECTURE §3). Los importes salen en euros con coma decimal, y las compras simuladas no son
// ingresos: se excluyen de las ventas y del resumen mensual (BE-FR-25 CA3).
import type { CsvCell } from '$lib/server/shared/csv';

export interface PaymentFact {
	readonly paymentId: string;
	readonly userId: string;
	/** Día civil de Madrid de la compra, `YYYY-MM-DD`. */
	readonly date: string;
	readonly country: string;
	readonly baseEurCents: number;
	readonly vatEurCents: number;
	readonly totalEurCents: number;
	readonly refundedEurCents: number;
	readonly chargebackEurCents: number;
	readonly simulated: boolean;
	readonly providerRef: string | null;
}

/** Compra con los datos que solo guarda `invoicing`: número de factura y NIF del perfil fiscal. */
export interface SaleFact extends PaymentFact {
	readonly invoiceNumber: string | null;
	readonly taxId: string | null;
}

export interface AiCostFact {
	readonly date: string;
	readonly provider: string;
	readonly app: string;
	readonly usdMicro: number;
	readonly eurCents: number;
}

export const SALES_HEADER = Object.freeze([
	'fecha',
	'usuario',
	'nif',
	'pais',
	'base',
	'cuota_iva',
	'total',
	'factura',
	'referencia_proveedor',
	'reembolsos',
	'contracargos'
] as const);

export const MONTHLY_HEADER = Object.freeze([
	'mes',
	'ventas',
	'base',
	'cuota_iva',
	'total',
	'reembolsos',
	'contracargos'
] as const);

export const AI_COSTS_HEADER = Object.freeze([
	'fecha',
	'proveedor',
	'app',
	'coste_usd',
	'coste_eur'
] as const);

/** Céntimos a euros para la hoja de cálculo: el número sale con coma decimal al escribirse. */
const eur = (cents: number): number => cents / 100;

export function saleRows(sales: readonly SaleFact[]): CsvCell[][] {
	return sales
		.filter((sale) => !sale.simulated)
		.map((sale) => [
			sale.date,
			sale.userId,
			sale.taxId ?? '',
			sale.country,
			eur(sale.baseEurCents),
			eur(sale.vatEurCents),
			eur(sale.totalEurCents),
			sale.invoiceNumber ?? '',
			sale.providerRef ?? '',
			eur(sale.refundedEurCents),
			eur(sale.chargebackEurCents)
		]);
}

export function monthlySummaryRows(sales: readonly PaymentFact[]): CsvCell[][] {
	const byMonth = new Map<string, PaymentFact[]>();
	for (const sale of sales) {
		if (sale.simulated) continue;
		const month = sale.date.slice(0, 7);
		const group = byMonth.get(month);
		if (group) group.push(sale);
		else byMonth.set(month, [sale]);
	}
	const sum = (items: readonly PaymentFact[], pick: (sale: PaymentFact) => number): number =>
		items.reduce((total, sale) => total + pick(sale), 0);
	return [...byMonth.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([month, items]) => [
			month,
			items.length,
			eur(sum(items, (sale) => sale.baseEurCents)),
			eur(sum(items, (sale) => sale.vatEurCents)),
			eur(sum(items, (sale) => sale.totalEurCents)),
			eur(sum(items, (sale) => sale.refundedEurCents)),
			eur(sum(items, (sale) => sale.chargebackEurCents))
		]);
}

export function aiCostRows(costs: readonly AiCostFact[]): CsvCell[][] {
	return costs.map((cost) => [
		cost.date,
		cost.provider,
		cost.app,
		cost.usdMicro / 1_000_000,
		eur(cost.eurCents)
	]);
}
