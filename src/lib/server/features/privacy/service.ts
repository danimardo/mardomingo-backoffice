// Servicio de `privacy` (BE-FR-07, BE-FR-08; T281, T284). No tiene tablas: orquesta la exportación y el borrado llamando a la
// API pública de las dueñas de los datos, que son las únicas que leen o escriben sus tablas. El borrado es una sola
// transacción: si una de las dueñas falla, no queda nada a medias.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { emailOfUser, type Accounts, type ProfileExport } from '$lib/server/features/accounts';
import {
	anonymizeOperationsBefore,
	exportOperations,
	type OperationExport
} from '$lib/server/features/ai';
import { appNamesOf, getSetting, operationNamesOf, type AppsDeps } from '$lib/server/features/apps';
import type { Credits, MovementExportRow } from '$lib/server/features/credits';
import type {
	BillingProfileExport,
	InvoiceView,
	InvoicingService
} from '$lib/server/features/invoicing';
import {
	exportAcceptances,
	type AcceptanceExport,
	type LegalDeps
} from '$lib/server/features/legal';
import {
	purgeAlertKeysBefore,
	sendAccountEmail,
	type NotificationsDeps
} from '$lib/server/features/notifications';
import type { PaymentExport, PaymentsService } from '$lib/server/features/payments';
import {
	deleteAllForUser,
	exportDocuments,
	type SyncDeps,
	type SyncDocumentExport
} from '$lib/server/features/sync';
import type { Logger } from '$lib/server/logging/logger';
import { civilDateOf, DAY_MS } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { decideInactivity } from './domain/inactivity';
import { retentionCutoffs } from './domain/retention';

export interface PrivacyDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly apps: AppsDeps;
	readonly accounts: Accounts;
	readonly credits: Credits;
	readonly sync: SyncDeps;
	readonly legal: LegalDeps;
	readonly invoicing: InvoicingService;
	readonly payments: PaymentsService;
	readonly notifications: NotificationsDeps;
	/** Origen público de la web: base del enlace del aviso de inactividad. */
	readonly publicWebUrl: string;
}

/** Documento de la exportación RGPD (BE-FR-08). `schemaVersion` sube si cambia la forma. */
export interface UserDataExport {
	readonly schemaVersion: 1;
	readonly exportedAt: string;
	readonly profile: ProfileExport | null;
	readonly billingProfile: BillingProfileExport | null;
	readonly syncedDocuments: readonly (SyncDocumentExport & { readonly appName: string })[];
	readonly movements: readonly MovementExportRow[];
	readonly operations: readonly (OperationExport & {
		readonly appName: string;
		readonly operation: string;
	})[];
	readonly payments: readonly PaymentExport[];
	readonly invoices: readonly InvoiceView[];
	readonly legalAcceptances: readonly AcceptanceExport[];
}

/** Todo lo que la plataforma guarda de la cuenta, por dueña. El contenido nunca se registra: solo la duración. */
export function exportUserData(deps: PrivacyDeps, userId: string): UserDataExport {
	const started = performance.now();
	const syncedDocuments = exportDocuments(deps.sync, userId);
	const operations = exportOperations(deps, userId);
	const appNames = appNamesOf(deps.apps, [
		...syncedDocuments.map((item) => item.appId),
		...operations.map((item) => item.appId)
	]);
	const operationNames = operationNamesOf(
		deps.apps,
		operations.map((item) => item.appOperationId)
	);
	const result: UserDataExport = {
		schemaVersion: 1,
		exportedAt: new Date(deps.clock.now()).toISOString(),
		profile: deps.accounts.exportProfile(userId),
		billingProfile: deps.invoicing.exportBillingProfile(userId),
		syncedDocuments: syncedDocuments.map((item) => ({
			...item,
			appName: appNames.get(item.appId) ?? ''
		})),
		movements: deps.credits.exportMovements(userId),
		operations: operations.map((item) => ({
			...item,
			appName: appNames.get(item.appId) ?? '',
			operation: operationNames.get(item.appOperationId) ?? ''
		})),
		payments: deps.payments.exportPayments(userId),
		invoices: deps.invoicing.invoicesFor(deps.payments.paymentIdsOf(userId)),
		legalAcceptances: exportAcceptances(deps.legal, userId)
	};
	deps.logger.emit('privacy.export.generated', {
		durationMs: Math.round(performance.now() - started)
	});
	return result;
}

export type DeleteAccountInput =
	| { readonly userId: string; readonly reason: 'user'; readonly password: string }
	| { readonly userId: string; readonly reason: 'inactivity' };

export type DeleteAccountOutcome =
	| { readonly status: 'deleted'; readonly forfeitedMicro: number }
	| { readonly status: 'wrong_password' | 'not_found' };

class AlreadyDeleted extends Error {}

/**
 * Borra la cuenta (BE-FR-07): libera las reservas, anula el saldo con movimientos `forfeit`, cierra todas las sesiones,
 * borra el perfil fiscal y los documentos sincronizados y anonimiza la cuenta. Las tablas inmutables no se tocan (D-18).
 * Con motivo `user` exige la contraseña; con `inactivity` (BE-FR-86) la llama la tarea diaria, sin contraseña.
 */
export async function deleteAccount(
	deps: PrivacyDeps,
	input: DeleteAccountInput
): Promise<DeleteAccountOutcome> {
	if (input.reason === 'user') {
		const matches = await deps.accounts.passwordMatches(input.userId, input.password);
		if (!matches) {
			deps.logger.emit('privacy.account.deletion_rejected', { reason: 'wrong_password' });
			return { status: 'wrong_password' };
		}
	}
	let forfeitedMicro = 0;
	try {
		// Las transacciones de cada dueña, abiertas dentro de esta, pasan a ser puntos de guardado: o todo o nada.
		immediateTransaction(deps.db, () => {
			deps.credits.releaseOpenHolds(input.userId);
			forfeitedMicro = deps.credits.forfeitAll(input.userId, input.reason).forfeitedMicro;
			deps.accounts.revokeAllSessions(input.userId);
			deps.invoicing.deleteBillingProfile(input.userId);
			deleteAllForUser(deps.sync, input.userId);
			if (!deps.accounts.anonymizeUser(input.userId)) throw new AlreadyDeleted();
		});
	} catch (error) {
		if (error instanceof AlreadyDeleted) {
			deps.logger.emit('privacy.account.deletion_rejected', { reason: 'not_found' });
			return { status: 'not_found' };
		}
		throw error;
	}
	deps.logger.emit('privacy.account.deleted', { reason: input.reason });
	return { status: 'deleted', forfeitedMicro };
}

export interface RetentionReport {
	readonly sessions: number;
	readonly aiOperations: number;
	readonly other: number;
}

/**
 * Aplica los plazos de retención de BE-FR-83 (data-model §6): cada dueña de datos borra o anonimiza lo suyo y aquí solo se
 * suman los recuentos por categoría. Las IP de registro y de aceptaciones legales no se tocan: se conservan mientras exista la
 * cuenta y después durante el plazo de prescripción, que está pendiente de confirmar (H-17).
 */
export function applyRetention(deps: PrivacyDeps): RetentionReport {
	const now = toEpochMs(deps.clock.now());
	const cutoffs = retentionCutoffs(now);
	const sessions = deps.accounts.purgeExpiredSessions(cutoffs.sessionsExpiredBefore);
	const aiOperations = anonymizeOperationsBefore(deps, cutoffs.operationsBefore);
	const other =
		deps.accounts.purgeAuthAttempts(cutoffs.attemptsBefore) +
		deps.accounts.purgeExpiredVerifications(cutoffs.verificationsExpiredBefore) +
		deps.credits.purgeReleasedHolds(cutoffs.holdsReleasedBefore) +
		purgeAlertKeysBefore(deps, cutoffs.alertsBefore);
	deps.logger.emit('privacy.retention.applied', { reason: 'sessions', count: sessions });
	deps.logger.emit('privacy.retention.applied', { reason: 'ai_operations', count: aiOperations });
	deps.logger.emit('privacy.retention.applied', { reason: 'other', count: other });
	return { sessions, aiOperations, other };
}

export interface InactiveReport {
	readonly notified: number;
	readonly cancelled: number;
	readonly deleted: number;
}

function numberSetting(
	deps: PrivacyDeps,
	key: 'inactive_account_years' | 'inactive_account_notice_days'
): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number') throw new Error(`falta el parámetro ${key}`);
	return value;
}

/**
 * Cuentas inactivas (BE-FR-86): avisa a las verificadas sin compra real que llevan `inactive_account_years` años sin actividad,
 * cancela el borrado de las que volvieron durante el aviso y borra (como el borrado de la cuenta, con `forfeit` de lo que
 * quede) las que siguen inactivas pasados `inactive_account_notice_days` días. Una cuenta con compra real no se toca nunca.
 * Un aviso que no sale (el proveedor falla) no se anota: se reintenta en la siguiente ejecución.
 */
export async function processInactive(deps: PrivacyDeps): Promise<InactiveReport> {
	const now = toEpochMs(deps.clock.now());
	const config = {
		years: numberSetting(deps, 'inactive_account_years'),
		noticeDays: numberSetting(deps, 'inactive_account_notice_days')
	};
	// Prefiltro con años de 365 días, que incluye a todas las que cumplen el plazo de calendario; la decisión es exacta.
	const candidates = deps.accounts.inactivityCandidates(
		toEpochMs(now - config.years * 365 * DAY_MS)
	);
	const paying = deps.credits.realPurchaseUserIds(candidates.map((candidate) => candidate.userId));

	let notified = 0;
	let cancelled = 0;
	let deleted = 0;
	for (const candidate of candidates) {
		if (paying.has(candidate.userId)) {
			// Con compra real no se cierra nunca. Si compró durante el aviso, el aviso pendiente ya no significa nada.
			if (candidate.warnedAt !== null) deps.accounts.clearInactivityWarning(candidate.userId);
			continue;
		}
		const decision = decideInactivity(
			{ referenceAt: candidate.referenceAt, warnedAt: candidate.warnedAt, hasRealPurchase: false },
			now,
			config
		);
		if (decision === 'cancel') {
			deps.accounts.clearInactivityWarning(candidate.userId);
			deps.logger.emit('privacy.inactive.cancelled', {});
			cancelled += 1;
		} else if (decision === 'warn') {
			const to = emailOfUser(deps.db, candidate.userId);
			if (to === null) continue;
			const sent = await sendAccountEmail(deps.notifications, {
				reason: 'inactivity_notice',
				to,
				link: `${deps.publicWebUrl}/login`,
				inactivity: config,
				idempotencyKey: `inactivity-notice-${candidate.userId}-${civilDateOf(now)}`
			});
			if (!sent) continue;
			deps.accounts.markInactivityWarned(candidate.userId, now);
			notified += 1;
		} else if (decision === 'delete') {
			const outcome = await deleteAccount(deps, { userId: candidate.userId, reason: 'inactivity' });
			if (outcome.status === 'deleted') deleted += 1;
		}
	}
	if (notified > 0) deps.logger.emit('privacy.inactive.notified', { count: notified });
	return { notified, cancelled, deleted };
}
