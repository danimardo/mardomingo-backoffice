// Servicio de `privacy` (BE-FR-07, BE-FR-08; T281, T284). No tiene tablas: orquesta la exportación y el borrado llamando a la
// API pública de las dueñas de los datos, que son las únicas que leen o escriben sus tablas. El borrado es una sola
// transacción: si una de las dueñas falla, no queda nada a medias.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { Accounts, ProfileExport } from '$lib/server/features/accounts';
import { exportOperations, type OperationExport } from '$lib/server/features/ai';
import { appNamesOf, operationNamesOf, type AppsDeps } from '$lib/server/features/apps';
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
import type { PaymentExport, PaymentsService } from '$lib/server/features/payments';
import {
	deleteAllForUser,
	exportDocuments,
	type SyncDeps,
	type SyncDocumentExport
} from '$lib/server/features/sync';
import type { Logger } from '$lib/server/logging/logger';

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
			forfeitedMicro = deps.credits.forfeitAll(input.userId).forfeitedMicro;
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
