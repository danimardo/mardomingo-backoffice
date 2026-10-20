// Alerta manual de facturación de Mistral (T326; BE-FR-33, L14). Mistral no ofrece aquí un endpoint de saldo verificado: el administrador
// declara en W44 si hay un error de facturación. Declararlo levanta la alerta `mistral_billing`; quitarlo la limpia. Cada cambio se audita.
import { immediateTransaction } from '$lib/server/db/tx';
import type { AuditDeps } from '$lib/server/features/audit';
import { recordEntry } from '$lib/server/features/audit';
import { alertKeys } from './domain/alert-state';
import { clearAlert, raiseAlert, type AlertDeps } from './alerts';

export async function setMistralBillingError(
	deps: AlertDeps & { readonly audit: AuditDeps },
	input: { readonly adminId: string; readonly error: boolean; readonly reason: string }
): Promise<void> {
	const key = alertKeys.mistralBilling();
	if (input.error) {
		await raiseAlert(deps, {
			key,
			detail: `Error de facturación de Mistral declarado por el administrador: ${input.reason}`
		});
	} else {
		clearAlert(deps, key);
	}
	immediateTransaction(deps.db, (tx) =>
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'notifications.mistral_billing.set',
				entity: 'alert',
				entityId: 'mistral_billing',
				before: {},
				after: { error: input.error },
				reason: input.reason
			},
			deps.audit
		)
	);
}
