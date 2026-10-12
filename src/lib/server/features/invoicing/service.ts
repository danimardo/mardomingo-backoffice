// Servicio de `invoicing` (BE-FR-74, BE-FR-75; T238). Cada emisión va en una transacción `BEGIN IMMEDIATE`: la comprobación de
// la clave de emisión y la inserción de la factura ocurren juntas, así que un reintento no emite dos veces. Con el proveedor
// `none` o con una compra simulada no se emite nada (BE-FR-25 CA3).
import type { InvoicingProvider } from '$lib/server/adapters/invoicing/provider';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import { BillingProfile } from '$lib/schemas/invoicing/billing-profile';
import { toCsv } from '$lib/server/shared/csv';
import {
	AI_COSTS_HEADER,
	MONTHLY_HEADER,
	SALES_HEADER,
	aiCostRows,
	monthlySummaryRows,
	saleRows,
	type AiCostFact,
	type PaymentFact,
	type SaleFact
} from './domain/accounting-csv';
import { toEpochMs } from '$lib/shared/time';
import {
	billingProfileOf,
	insertInvoice,
	initialInvoiceOf,
	invoiceByIssueKey,
	invoiceById,
	upsertBillingProfile
} from './repository';

export interface InvoicingDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly provider: InvoicingProvider;
}

export type SaveProfileOutcome =
	{ readonly status: 'saved' } | { readonly status: 'rejected'; readonly reason: string };

/** Guarda el perfil fiscal validado (BE-FR-74). Un perfil rechazado no toca el guardado anterior. */
export function saveBillingProfile(
	deps: InvoicingDeps,
	input: { readonly userId: string; readonly profile: unknown }
): SaveProfileOutcome {
	const parsed = BillingProfile.safeParse(input.profile);
	if (!parsed.success) {
		const reason = parsed.error.issues[0]?.message ?? 'invoicing_profile_invalid';
		deps.logger.emit('invoicing.billing_profile.rejected', { reason: 'validation' });
		return { status: 'rejected', reason };
	}
	immediateTransaction(deps.db, (tx) => {
		upsertBillingProfile(tx, { userId: input.userId, ...parsed.data }, toEpochMs(deps.clock.now()));
	});
	deps.logger.emit('invoicing.billing_profile.updated', {});
	return { status: 'saved' };
}

export type IssueOutcome =
	| {
			readonly status: 'issued';
			readonly invoiceId: string;
			readonly series: string;
			readonly number: string;
	  }
	| { readonly status: 'skipped'; readonly reason: 'simulated' | 'provider_none' | 'not_issued' }
	| { readonly status: 'duplicate' }
	| {
			readonly status: 'rejected';
			readonly reason: 'billing_profile_required' | 'original_not_found';
	  };

export interface IssueForPaymentInput {
	readonly paymentId: string;
	readonly userId: string;
	readonly simulated: boolean;
	readonly kind: 'simplified' | 'full';
	readonly amountEurCents: number;
	readonly issueKey: string;
}

/**
 * Emite la factura de una compra (BE-FR-75). La simplificada no lleva datos fiscales; la completa copia el perfil vigente en
 * el momento de la emisión (`billing_snapshot`), que no cambia si el perfil se edita después (BE-FR-74 CA3).
 */
export function issueForPayment(deps: InvoicingDeps, input: IssueForPaymentInput): IssueOutcome {
	const skipped = skipReason(deps, input.simulated);
	if (skipped !== null) return skipped;
	return immediateTransaction(deps.db, (tx): IssueOutcome => {
		if (invoiceByIssueKey(tx, input.issueKey) !== undefined) {
			deps.logger.emit('invoicing.invoice.duplicate', {});
			return { status: 'duplicate' };
		}
		const snapshot = input.kind === 'full' ? snapshotOf(tx, input.userId) : null;
		if (input.kind === 'full' && snapshot === null) {
			deps.logger.emit('invoicing.invoice.rejected', { reason: 'billing_profile_required' });
			return { status: 'rejected', reason: 'billing_profile_required' };
		}
		const issued = deps.provider.issueInvoice({
			issueKey: input.issueKey,
			amountEurCents: input.amountEurCents,
			billingSnapshot: snapshot
		});
		if (!issued.ok) {
			deps.logger.emit('invoicing.invoice.skipped', { reason: 'not_issued' });
			return { status: 'skipped', reason: 'not_issued' };
		}
		return record(deps, tx, {
			paymentId: input.paymentId,
			kind: input.kind,
			amountEurCents: input.amountEurCents,
			billingSnapshot: snapshot,
			correctsInvoiceId: null,
			issueKey: input.issueKey,
			issued: issued.invoice,
			providerName: deps.provider.name
		});
	});
}

export interface IssueCorrectiveInput {
	readonly paymentId: string;
	readonly userId: string;
	readonly simulated: boolean;
	readonly correctsInvoiceId: string;
	/** Importe a rectificar en positivo: la rectificativa lo guarda en negativo (BE-FR-27, BE-FR-28). */
	readonly amountEurCents: number;
	readonly issueKey: string;
}

/** Rectificativa de un reembolso o contracargo, que apunta a la factura original (BE-FR-27, BE-FR-28). */
export function issueCorrective(deps: InvoicingDeps, input: IssueCorrectiveInput): IssueOutcome {
	const skipped = skipReason(deps, input.simulated);
	if (skipped !== null) return skipped;
	return immediateTransaction(deps.db, (tx): IssueOutcome => {
		if (invoiceByIssueKey(tx, input.issueKey) !== undefined) {
			deps.logger.emit('invoicing.invoice.duplicate', {});
			return { status: 'duplicate' };
		}
		const original = invoiceById(tx, input.correctsInvoiceId);
		if (original === undefined) {
			deps.logger.emit('invoicing.invoice.rejected', { reason: 'original_not_found' });
			return { status: 'rejected', reason: 'original_not_found' };
		}
		const issued = deps.provider.issueCorrective({
			issueKey: input.issueKey,
			amountEurCents: -input.amountEurCents,
			billingSnapshot: null,
			correctsNumber: original.number
		});
		if (!issued.ok) {
			deps.logger.emit('invoicing.invoice.skipped', { reason: 'not_issued' });
			return { status: 'skipped', reason: 'not_issued' };
		}
		return record(deps, tx, {
			paymentId: input.paymentId,
			kind: 'corrective',
			amountEurCents: -input.amountEurCents,
			billingSnapshot: null,
			correctsInvoiceId: original.id,
			issueKey: input.issueKey,
			issued: issued.invoice,
			providerName: deps.provider.name
		});
	});
}

/** Motivo por el que no se emite nada, o `null` si se puede emitir. */
function skipReason(deps: InvoicingDeps, simulated: boolean): IssueOutcome | null {
	if (simulated) {
		deps.logger.emit('invoicing.invoice.skipped', { reason: 'simulated' });
		return { status: 'skipped', reason: 'simulated' };
	}
	if (deps.provider.name === 'none') {
		deps.logger.emit('invoicing.invoice.skipped', { reason: 'provider_none' });
		return { status: 'skipped', reason: 'provider_none' };
	}
	return null;
}

function snapshotOf(db: Db | Tx, userId: string): Readonly<Record<string, unknown>> | null {
	const row = billingProfileOf(db, userId);
	if (row === undefined) return null;
	return {
		kind: row.kind,
		legalName: row.legalName,
		taxId: row.taxId,
		address: row.address,
		postalCode: row.postalCode,
		city: row.city,
		country: row.country
	};
}

function record(
	deps: InvoicingDeps,
	tx: Tx,
	row: {
		readonly paymentId: string;
		readonly kind: 'simplified' | 'full' | 'corrective';
		readonly amountEurCents: number;
		readonly billingSnapshot: Readonly<Record<string, unknown>> | null;
		readonly correctsInvoiceId: string | null;
		readonly issueKey: string;
		readonly issued: {
			readonly series: string;
			readonly number: string;
			readonly providerRef: string;
		};
		readonly providerName: string;
	}
): IssueOutcome {
	const id = deps.ids('inv');
	insertInvoice(tx, {
		id,
		paymentId: row.paymentId,
		kind: row.kind,
		series: row.issued.series,
		number: row.issued.number,
		billingSnapshot: row.billingSnapshot,
		amountEurCents: row.amountEurCents,
		correctsInvoiceId: row.correctsInvoiceId,
		issueKey: row.issueKey,
		provider: row.providerName,
		providerRef: row.issued.providerRef,
		issuedAt: toEpochMs(deps.clock.now())
	});
	deps.logger.emit('invoicing.invoice.issued', { kind: row.kind });
	return {
		status: 'issued',
		invoiceId: id,
		series: row.issued.series,
		number: row.issued.number
	};
}

export interface CorrectPaymentInput {
	readonly paymentId: string;
	readonly userId: string;
	readonly simulated: boolean;
	/** Importe devuelto o contracargado, en positivo (BE-FR-27, BE-FR-28). */
	readonly amountEurCents: number;
	readonly issueKey: string;
}

/**
 * Rectificativa de una compra sin conocer la factura original: la busca por compra. Si la compra no tuvo factura (simulada,
 * o proveedor `none`), no se emite nada. La búsqueda va fuera de la transacción de emisión, que abre `issueCorrective`.
 */
export function correctPayment(deps: InvoicingDeps, input: CorrectPaymentInput): IssueOutcome {
	const skipped = skipReason(deps, input.simulated);
	if (skipped !== null) return skipped;
	const original = initialInvoiceOf(deps.db, input.paymentId);
	if (original === undefined) {
		deps.logger.emit('invoicing.invoice.rejected', { reason: 'original_not_found' });
		return { status: 'rejected', reason: 'original_not_found' };
	}
	return issueCorrective(deps, {
		paymentId: input.paymentId,
		userId: input.userId,
		simulated: input.simulated,
		correctsInvoiceId: original.id,
		amountEurCents: input.amountEurCents,
		issueKey: input.issueKey
	});
}

export interface InvoicingService {
	saveBillingProfile(input: {
		readonly userId: string;
		readonly profile: unknown;
	}): SaveProfileOutcome;
	issueForPayment(input: IssueForPaymentInput): IssueOutcome;
	issueCorrective(input: IssueCorrectiveInput): IssueOutcome;
	correctPayment(input: CorrectPaymentInput): IssueOutcome;
}

export function createInvoicingService(deps: InvoicingDeps): InvoicingService {
	return {
		saveBillingProfile: (input) => saveBillingProfile(deps, input),
		issueForPayment: (input) => issueForPayment(deps, input),
		issueCorrective: (input) => issueCorrective(deps, input),
		correctPayment: (input) => correctPayment(deps, input)
	};
}

export interface AccountingExportInput {
	/** Compras del periodo, con los datos que guarda `payments` (llegan por parámetro: no se leen tablas ajenas). */
	readonly payments: readonly PaymentFact[];
	/** Coste de IA por proveedor, día y app, recibido de `ai` por parámetro (ARCHITECTURE §3). */
	readonly aiCosts: readonly AiCostFact[];
}

export interface AccountingExport {
	readonly salesCsv: string;
	readonly monthlyCsv: string;
	readonly aiCostsCsv: string;
}

/**
 * Exportación contable (BE-FR-76): ventas con número de factura y NIF de su cuenta, resumen mensual y coste de IA. Los archivos
 * llevan BOM y el formato de hoja de cálculo común (`shared/csv`). Las compras simuladas no son ingresos.
 */
export function accountingExport(
	deps: InvoicingDeps,
	input: AccountingExportInput
): AccountingExport {
	const sales: SaleFact[] = input.payments.map((payment) => {
		const invoice = initialInvoiceOf(deps.db, payment.paymentId);
		const profile = billingProfileOf(deps.db, payment.userId);
		return {
			...payment,
			invoiceNumber: invoice?.number ?? null,
			taxId: profile?.taxId ?? null
		};
	});
	deps.logger.emit('invoicing.export.generated', {});
	return {
		salesCsv: toCsv(saleRows(sales), { header: SALES_HEADER, bom: true }),
		monthlyCsv: toCsv(monthlySummaryRows(sales), { header: MONTHLY_HEADER, bom: true }),
		aiCostsCsv: toCsv(aiCostRows(input.aiCosts), { header: AI_COSTS_HEADER, bom: true })
	};
}
