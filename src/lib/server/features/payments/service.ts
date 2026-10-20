// Servicio de `payments` (BE-FR-23–28; T236). Compra, eventos del proveedor y reembolsos. Cada escritura va en su transacción
// `BEGIN IMMEDIATE`; el saldo solo lo toca `credits` (una transacción propia por operación). Por eso el orden es el de la
// idempotencia: primero se acredita (que ya es idempotente por `payment_id`) y después se marca la compra; si algo falla entre
// medias, el reintento lo cierra sin acreditar dos veces.
import type { PaymentsProvider, PaymentEvent } from '$lib/server/adapters/payments/provider';
import type { AppEnv } from '$lib/server/config/env-schema';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { getSetting, type AppsDeps } from '$lib/server/features/apps';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import { blockAccount } from '$lib/server/features/accounts';
import type { Credits } from '$lib/server/features/credits';
import type { InvoicingService } from '$lib/server/features/invoicing';
import { isOwnWithdrawalWaiver, type LegalDeps } from '$lib/server/features/legal';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';
import { civilDateOf } from '$lib/shared/dates';
import { and, asc, gte, lte } from 'drizzle-orm';
import { payments } from './schema';
import { toEurCents, toMicro, toPpm } from '$lib/shared/money';
import { packCreditsMicro } from './domain/pack-credits';
import { planRefund } from './domain/refund';
import { splitVat } from './domain/vat';
import {
	activePacks,
	findByAttempt,
	findById,
	findByProviderRef,
	findPack,
	insertPayment,
	markWantsFullInvoice,
	paymentIdsOfUser,
	paymentsOfUser,
	setRefundedEurCents,
	setStatus,
	type PaymentRow
} from './repository';

/** IVA de España incluido en el precio (BE-FR-25 CA5). */
const VAT_RATE_PPM = 210_000;
const COUNTRY = 'ES';

export interface PaymentsDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly appEnv: AppEnv;
	readonly apps: AppsDeps;
	readonly provider: PaymentsProvider;
	readonly credits: Credits;
	readonly invoicing: InvoicingService;
	readonly legal: LegalDeps;
	readonly auditDeps: AuditDeps;
}

export interface PurchaseInput {
	readonly userId: string;
	/** Roles separados por comas, leídos del servidor (`user`, `tester`, `admin`). */
	readonly role: string;
	readonly attemptId: string;
	readonly packId: string;
	readonly wantsFullInvoice: boolean;
	/** Id de la renuncia al desistimiento que `legal` acaba de registrar para esta compra (BE-FR-26). */
	readonly withdrawalAcceptanceId: string;
}

export type PurchaseOutcome =
	| { readonly status: 'completed'; readonly paymentId: string; readonly creditsMicro: number }
	| { readonly status: 'pending'; readonly paymentId: string }
	| { readonly status: 'repeated'; readonly paymentId: string };

export type RefundOutcome =
	| { readonly status: 'refunded'; readonly refundedEurCents: number }
	| { readonly status: 'partially_refunded'; readonly refundedEurCents: number };

function numberSetting(deps: PaymentsDeps, key: Parameters<typeof getSetting>[1]): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'setting_missing' });
	return value;
}

/** Los testers y los administradores pueden comprar en simulado en producción (BE-FR-25 CA2). */
function canBuySimulated(role: string): boolean {
	const roles = role.split(',').map((item) => item.trim());
	return roles.includes('tester') || roles.includes('admin');
}

/**
 * Compra de un paquete (BE-FR-23, BE-FR-25). El cobro se crea antes de guardar la compra: si el proveedor no responde, no
 * queda nada a medias. Con el proveedor simulado la compra se completa al instante; con uno real queda `pending` hasta su
 * webhook.
 */
export function purchase(deps: PaymentsDeps, input: PurchaseInput): PurchaseOutcome {
	if (
		deps.provider.name === 'simulated' &&
		deps.appEnv === 'production' &&
		!canBuySimulated(input.role)
	) {
		throw new AppError('PURCHASE_NOT_AVAILABLE');
	}
	const repeated = findByAttempt(deps.db, input.userId, input.attemptId);
	if (repeated !== undefined) {
		deps.logger.emit('payments.purchase.duplicate', {});
		return { status: 'repeated', paymentId: repeated.id };
	}
	const pack = findPack(deps.db, input.packId);
	if (pack === undefined || !pack.active) throw new AppError('PACK_INACTIVE');
	if (!isOwnWithdrawalWaiver(deps.db, input.userId, input.withdrawalAcceptanceId)) {
		throw new AppError('VALIDATION_ERROR', { field: 'withdrawalAcceptanceId' });
	}

	const vat = splitVat({ totalEurCents: pack.priceEurCents, country: COUNTRY });
	const creditsMicro = packCreditsMicro({
		priceEurCents: pack.priceEurCents,
		creditsPerEur: numberSetting(deps, 'credits_per_eur_purchase'),
		bonusPpm: pack.bonusPpm
	});
	const paymentId = deps.ids('pay');
	const checkout = deps.provider.createCheckout({ paymentId, amountEurCents: pack.priceEurCents });
	if (!checkout.ok) {
		deps.logger.emit('payments.purchase.failed', { reason: 'provider_unavailable' });
		throw new AppError('PAYMENT_PROVIDER_ERROR');
	}

	const now = toEpochMs(deps.clock.now());
	const inserted = immediateTransaction(deps.db, (tx) => {
		// Dos intentos a la vez con el mismo `attempt_id`: solo uno inserta; el otro recibe la compra existente.
		if (findByAttempt(tx, input.userId, input.attemptId) !== undefined) return false;
		insertPayment(tx, {
			id: paymentId,
			userId: input.userId,
			packId: pack.id,
			attemptId: input.attemptId,
			provider: deps.provider.name,
			providerRef: checkout.providerRef,
			status: 'pending',
			amountEurCents: toEurCents(pack.priceEurCents),
			baseEurCents: toEurCents(vat.baseEurCents),
			vatEurCents: toEurCents(vat.vatEurCents),
			vatRatePpm: toPpm(VAT_RATE_PPM),
			country: COUNTRY,
			creditsMicro: toMicro(creditsMicro),
			wantsFullInvoice: input.wantsFullInvoice,
			simulated: deps.provider.name === 'simulated',
			withdrawalAcceptanceId: input.withdrawalAcceptanceId,
			refundedEurCents: toEurCents(0),
			createdAt: now,
			updatedAt: now
		});
		return true;
	});
	if (!inserted) {
		const existing = findByAttempt(deps.db, input.userId, input.attemptId);
		deps.logger.emit('payments.purchase.duplicate', {});
		return { status: 'repeated', paymentId: existing?.id ?? paymentId };
	}

	if (deps.provider.name !== 'simulated') return { status: 'pending', paymentId };
	const row = findById(deps.db, paymentId);
	if (row === undefined) throw new AppError('INTERNAL_ERROR', { reason: 'payment_missing' });
	completePayment(deps, row);
	return { status: 'completed', paymentId, creditsMicro };
}

/**
 * Acredita una compra pendiente y la marca como completada. Si ya está completada, no hace nada: un evento repetido no
 * acredita dos veces (BE-FR-24 CA1).
 */
function completePayment(deps: PaymentsDeps, row: PaymentRow): void {
	deps.credits.grantPurchase({
		userId: row.userId,
		paymentId: row.id,
		amountMicro: row.creditsMicro,
		simulated: row.simulated
	});
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		setStatus(tx, row.id, 'completed', now, now);
	});
	deps.invoicing.issueForPayment({
		paymentId: row.id,
		userId: row.userId,
		simulated: row.simulated,
		kind: row.wantsFullInvoice ? 'full' : 'simplified',
		amountEurCents: row.amountEurCents,
		issueKey: `payment:${row.id}:initial`
	});
	deps.logger.emit('payments.purchase.completed', {});
}

/**
 * Aplica los eventos de un webhook del proveedor (BE-FR-24). Un evento ya aplicado se registra como repetido y no cambia nada.
 * Los reembolsos los inicia el administrador (BE-FR-27), así que `payment_refunded` no se aplica desde el proveedor.
 */
export function handleProviderEvents(deps: PaymentsDeps, body: unknown): void {
	for (const event of deps.provider.handleWebhook(body)) {
		applyEvent(deps, event);
	}
}

function applyEvent(deps: PaymentsDeps, event: PaymentEvent): void {
	const row = findByProviderRef(deps.db, event.providerRef);
	if (row === undefined) return;
	if (event.type === 'payment_completed') {
		if (row.status !== 'pending') {
			deps.logger.emit('payments.webhook.duplicate', {});
			return;
		}
		completePayment(deps, row);
		return;
	}
	if (event.type === 'chargeback_opened') {
		if (row.status === 'chargeback') {
			deps.logger.emit('payments.webhook.duplicate', {});
			return;
		}
		applyChargeback(deps, row);
	}
}

/**
 * Contracargo (BE-FR-28): retira lo que quede de la compra, pasa el resto a deuda sin tope, rectifica la factura, bloquea la
 * cuenta y marca la compra. `credits` no bloquea: lo hace `accounts` después, y la repetición no vuelve a empezar.
 */
function applyChargeback(deps: PaymentsDeps, row: PaymentRow): void {
	deps.credits.applyChargeback({ userId: row.userId, paymentId: row.id });
	const remainingEurCents = row.amountEurCents - row.refundedEurCents;
	if (remainingEurCents > 0) {
		deps.invoicing.correctPayment({
			paymentId: row.id,
			userId: row.userId,
			simulated: row.simulated,
			amountEurCents: remainingEurCents,
			issueKey: `chargeback:${row.id}`
		});
	}
	blockAccount({ db: deps.db, logger: deps.logger }, { userId: row.userId, reason: 'chargeback' });
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		setStatus(tx, row.id, 'chargeback', now, row.completedAt);
	});
	deps.logger.emit('payments.chargeback.applied', {});
}

/** Créditos a retirar de un reembolso parcial, proporcionales al importe (redondeo hacia abajo). */
function creditsForRefund(row: PaymentRow, amountEurCents: number): number {
	return Number((BigInt(row.creditsMicro) * BigInt(amountEurCents)) / BigInt(row.amountEurCents));
}

/**
 * Vista previa del reembolso (BE-FR-27, T308): los créditos que se retirarían para ese importe, sin escribir nada. El
 * reembolso real vuelve a validar todo en `refund`.
 */
export function refundPreview(
	deps: PaymentsDeps,
	input: { readonly paymentId: string; readonly amountEurCents: number }
): { readonly creditsToWithdrawMicro: number; readonly refundableEurCents: number } {
	const row = findById(deps.db, input.paymentId);
	if (row === undefined) throw new AppError('NOT_FOUND');
	return {
		creditsToWithdrawMicro: creditsForRefund(row, input.amountEurCents),
		refundableEurCents: row.amountEurCents - row.refundedEurCents
	};
}

/**
 * Reembolso manual (BE-FR-27): motivo obligatorio, créditos retirados de la bolsa de la compra y rectificativa. La
 * auditoría registra el cambio en la misma transacción que el importe devuelto.
 */
export function refund(
	deps: PaymentsDeps,
	input: {
		readonly adminId: string;
		readonly paymentId: string;
		readonly amountEurCents: number;
		readonly reason: string;
	}
): RefundOutcome {
	const reason = input.reason.trim();
	if (reason.length === 0) throw new AppError('VALIDATION_ERROR', { field: 'reason' });
	const row = findById(deps.db, input.paymentId);
	if (row === undefined) throw new AppError('NOT_FOUND');
	const creditsToWithdrawMicro = creditsForRefund(row, input.amountEurCents);
	const plan = planRefund({
		paidEurCents: row.amountEurCents,
		alreadyRefundedEurCents: row.refundedEurCents,
		amountEurCents: input.amountEurCents,
		bucketRemainingMicro: row.creditsMicro,
		creditsToWithdrawMicro
	});
	if (!plan.ok) {
		deps.logger.emit('payments.refund.rejected', { reason: plan.reason });
		if (plan.reason === 'amount_not_positive')
			throw new AppError('VALIDATION_ERROR', { field: 'amount' });
		throw new AppError('PAYMENT_NOT_REFUNDABLE');
	}

	const withdrawal = deps.credits.withdrawForRefund({
		adminId: input.adminId,
		userId: row.userId,
		paymentId: row.id,
		amountMicro: creditsToWithdrawMicro,
		reason
	});
	if (!withdrawal.ok) {
		deps.logger.emit('payments.refund.rejected', { reason: withdrawal.reason });
		throw new AppError('PAYMENT_NOT_REFUNDABLE');
	}

	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx: Tx) => {
		setRefundedEurCents(tx, row.id, plan.newRefundedEurCents, now);
		setStatus(tx, row.id, plan.newStatus, now, row.completedAt);
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'payments.refund',
				entity: 'payment',
				entityId: row.id,
				before: { refundedEurCents: row.refundedEurCents },
				after: { refundedEurCents: plan.newRefundedEurCents },
				reason
			},
			deps.auditDeps
		);
	});
	deps.invoicing.correctPayment({
		paymentId: row.id,
		userId: row.userId,
		simulated: row.simulated,
		amountEurCents: input.amountEurCents,
		issueKey: `refund:${row.id}:${String(plan.newRefundedEurCents)}`
	});
	deps.logger.emit('payments.refund.applied', {});
	return { status: plan.newStatus, refundedEurCents: plan.newRefundedEurCents };
}

/** Paquete a la venta, con los créditos ya calculados con la tasa vigente (W20, BE-FR-23). */
export interface SalePack {
	readonly id: string;
	readonly name: string;
	readonly priceCents: number;
	readonly bonusPct: number;
	readonly creditsMicro: number;
}

export function packsForSale(deps: PaymentsDeps): SalePack[] {
	const creditsPerEur = numberSetting(deps, 'credits_per_eur_purchase');
	return activePacks(deps.db).map((pack) => ({
		id: pack.id,
		name: pack.name,
		priceCents: pack.priceEurCents,
		bonusPct: pack.bonusPpm / 10_000,
		creditsMicro: packCreditsMicro({
			priceEurCents: pack.priceEurCents,
			creditsPerEur,
			bonusPpm: pack.bonusPpm
		})
	}));
}

/** Disponibilidad de la compra para un rol: en producción simulada, solo testers y administradores (BE-FR-25 CA2, UX-06). */
export function purchaseAvailability(
	deps: PaymentsDeps,
	role: string
): { readonly canPurchase: boolean; readonly reason: 'coming_soon' | null } {
	const blocked =
		deps.provider.name === 'simulated' && deps.appEnv === 'production' && !canBuySimulated(role);
	return blocked
		? { canPurchase: false, reason: 'coming_soon' }
		: { canPurchase: true, reason: null };
}

/** Detalle de una compra del propio usuario (W21). Una compra ajena no existe para él. */
export interface PurchaseView {
	readonly packName: string;
	readonly priceCents: number;
	readonly vatCents: number;
	readonly creditsMicro: number;
	readonly simulated: boolean;
	readonly status: PaymentRow['status'];
	readonly completedAt: number | null;
}

export function purchaseOf(
	deps: PaymentsDeps,
	userId: string,
	paymentId: string
): PurchaseView | undefined {
	const row = findById(deps.db, paymentId);
	if (row === undefined || row.userId !== userId) return undefined;
	return {
		packName: findPack(deps.db, row.packId)?.name ?? '',
		priceCents: row.amountEurCents,
		vatCents: row.vatEurCents,
		creditsMicro: row.creditsMicro,
		simulated: row.simulated,
		status: row.status,
		completedAt: row.completedAt
	};
}

/** Pide factura completa de una compra propia (W30). `false` si la compra no es de la cuenta. */
export function requestFullInvoice(
	deps: PaymentsDeps,
	input: { readonly userId: string; readonly paymentId: string }
): boolean {
	const row = findById(deps.db, input.paymentId);
	if (row === undefined || row.userId !== input.userId) return false;
	immediateTransaction(deps.db, (tx) => {
		markWantsFullInvoice(tx, input.paymentId);
	});
	return true;
}

export function paymentIdsOf(deps: PaymentsDeps, userId: string): string[] {
	return paymentIdsOfUser(deps.db, userId);
}

export interface PaymentExport {
	readonly id: string;
	readonly packName: string;
	readonly status: PaymentRow['status'];
	readonly amountEurCents: number;
	readonly baseEurCents: number;
	readonly vatEurCents: number;
	readonly country: string;
	readonly creditsMicro: number;
	readonly simulated: boolean;
	readonly wantsFullInvoice: boolean;
	readonly refundedEurCents: number;
	readonly createdAt: string;
	readonly completedAt: string | null;
}

/** Pagos de la cuenta para la exportación RGPD (BE-FR-08). Sin referencias del proveedor. */
export function exportPayments(deps: PaymentsDeps, userId: string): PaymentExport[] {
	return paymentsOfUser(deps.db, userId).map((row) => ({
		id: row.id,
		packName: findPack(deps.db, row.packId)?.name ?? '',
		status: row.status,
		amountEurCents: row.amountEurCents,
		baseEurCents: row.baseEurCents,
		vatEurCents: row.vatEurCents,
		country: row.country,
		creditsMicro: row.creditsMicro,
		simulated: row.simulated,
		wantsFullInvoice: row.wantsFullInvoice,
		refundedEurCents: row.refundedEurCents,
		createdAt: new Date(row.createdAt).toISOString(),
		completedAt: row.completedAt === null ? null : new Date(row.completedAt).toISOString()
	}));
}

export interface PaymentsService {
	paymentFactsBetween(input: { readonly fromMs: number; readonly toMs: number }): PaymentFactRow[];
	exportPayments(userId: string): PaymentExport[];
	requestFullInvoice(input: { readonly userId: string; readonly paymentId: string }): boolean;
	refundPreview(input: { readonly paymentId: string; readonly amountEurCents: number }): {
		readonly creditsToWithdrawMicro: number;
		readonly refundableEurCents: number;
	};
	purchase(input: PurchaseInput): PurchaseOutcome;
	handleProviderEvents(body: unknown): void;
	refund(input: {
		readonly adminId: string;
		readonly paymentId: string;
		readonly amountEurCents: number;
		readonly reason: string;
	}): RefundOutcome;
	packsForSale(): SalePack[];
	availability(role: string): {
		readonly canPurchase: boolean;
		readonly reason: 'coming_soon' | null;
	};
	purchaseOf(userId: string, paymentId: string): PurchaseView | undefined;
	paymentIdsOf(userId: string): string[];
}

export function createPaymentsService(deps: PaymentsDeps): PaymentsService {
	return {
		paymentFactsBetween: (input) => paymentFactsBetween(deps, input),
		exportPayments: (userId) => exportPayments(deps, userId),
		purchase: (input) => purchase(deps, input),
		handleProviderEvents: (body) => {
			handleProviderEvents(deps, body);
		},
		refund: (input) => refund(deps, input),
		refundPreview: (input) => refundPreview(deps, input),
		packsForSale: () => packsForSale(deps),
		availability: (role) => purchaseAvailability(deps, role),
		purchaseOf: (userId, paymentId) => purchaseOf(deps, userId, paymentId),
		paymentIdsOf: (userId) => paymentIdsOf(deps, userId),
		requestFullInvoice: (input) => requestFullInvoice(deps, input)
	};
}

/**
 * Compras de un periodo para la exportación contable (BE-FR-76; T316): solo datos que ya guarda `payments`, con el día civil de
 * Madrid. Los importes de devolución y de contracargo se toman de la propia compra; sin fila, cero.
 */
export function paymentFactsBetween(
	deps: PaymentsDeps,
	input: { readonly fromMs: number; readonly toMs: number }
): PaymentFactRow[] {
	return deps.db
		.select()
		.from(payments)
		.where(
			and(
				gte(payments.createdAt, toEpochMs(input.fromMs)),
				lte(payments.createdAt, toEpochMs(input.toMs))
			)
		)
		.orderBy(asc(payments.createdAt), asc(payments.id))
		.all()
		.map((row) => ({
			paymentId: row.id,
			userId: row.userId,
			date: civilDateOf(toEpochMs(row.createdAt)),
			country: row.country,
			baseEurCents: row.baseEurCents,
			vatEurCents: row.vatEurCents,
			totalEurCents: row.amountEurCents,
			refundedEurCents: row.refundedEurCents,
			chargebackEurCents: row.status === 'chargeback' ? row.amountEurCents : 0,
			simulated: row.simulated,
			providerRef: row.providerRef
		}));
}

export interface PaymentFactRow {
	readonly paymentId: string;
	readonly userId: string;
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
