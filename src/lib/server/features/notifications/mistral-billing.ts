// Alerta manual de facturación de Mistral (T326; BE-FR-33, L14). Mistral no ofrece aquí un endpoint de saldo verificado: el administrador
// declara en W44 si hay un error de facturación. Declararlo levanta la alerta `mistral_billing`; quitarlo la limpia. Cada cambio se audita.
import { immediateTransaction } from '$lib/server/db/tx';
import type { AuditDeps } from '$lib/server/features/audit';
import { recordEntry } from '$lib/server/features/audit';
import { requireReason } from '$lib/server/shared/reason';
import { alertKeys } from './domain/alert-state';
import { clearAlert, raiseAlert, type AlertDeps } from './alerts';

export async function setMistralBillingError(
	deps: AlertDeps & { readonly audit: AuditDeps },
	input: { readonly adminId: string; readonly error: boolean; readonly reason: string }
): Promise<string> {
	// Motivo de 1 a 500 caracteres antes de tocar la alerta (C-55); se audita recortado.
	const reason = requireReason(input.reason);
	const key = alertKeys.mistralBilling();
	if (input.error) {
		await raiseAlert(deps, {
			key,
			detail: `Error de facturación de Mistral declarado por el administrador: ${reason}`
		});
	} else {
		clearAlert(deps, key);
	}
	// Devuelve el id de la entrada, que W44 enlaza al guardar (UX-13; C-54).
	return immediateTransaction(deps.db, (tx) =>
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'notifications.mistral_billing.set',
				entity: 'alert',
				entityId: 'mistral_billing',
				before: {},
				after: { error: input.error },
				reason
			},
			deps.audit
		)
	);
}
