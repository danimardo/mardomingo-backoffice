// Tarea `ledger-check` (BE-FR-15 CA1, SC-003, FR-025; T331): comprueba que el saldo de cada cuenta se reconstruye desde el ledger
// y avisa al administrador una sola vez por cuenta afectada. Cuando una cuenta vuelve a cuadrar, su alerta se rearma (sin email),
// así que una discrepancia nueva sobre la misma cuenta volvería a avisar.
import type { Db } from '$lib/server/db/client';
import type { Credits } from '$lib/server/features/credits';
import {
	activeAlerts,
	alertKeys,
	clearAlert,
	raiseAlert
} from '$lib/server/features/notifications';
import type { AlertDeps } from '$lib/server/features/notifications';

const PREFIX = 'ledger_mismatch:';

/** Devuelve cuántas cuentas tienen discrepancia en esta ejecución. */
export async function runLedgerCheck(deps: {
	readonly credits: Pick<Credits, 'checkLedger'>;
	readonly alerts: AlertDeps;
	readonly db: Pick<Db, 'select'>;
}): Promise<number> {
	const mismatched = deps.credits.checkLedger();
	for (const userId of mismatched) {
		await raiseAlert(deps.alerts, { key: alertKeys.ledgerMismatch(userId), detail: userId });
	}
	const stillWrong = new Set(mismatched);
	for (const alert of activeAlerts(deps.db)) {
		if (!alert.key.startsWith(PREFIX)) continue;
		const userId = alert.key.slice(PREFIX.length);
		if (!stillWrong.has(userId)) clearAlert(deps.alerts, alertKeys.ledgerMismatch(userId));
	}
	return mismatched.length;
}
