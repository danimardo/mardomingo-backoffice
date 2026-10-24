// Tarea `free-credits-expiry` (BE-FR-16, FR-026; T330): primero avisa por email de las bolsas gratuitas que caducan dentro de
// `free_expiry_warning_days` y después aplica las caducidades vencidas. El aviso sale una sola vez por bolsa (la marca lo hace
// `credits`); un fallo de envío no detiene la caducidad. Recibe funciones ya enlazadas (`emailOf`, `sendWarning`), no la base.
import { randomUUID } from 'node:crypto';
import type { Credits } from '$lib/server/features/credits';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExpiryWarning {
	readonly reason: 'free_expiry_warning';
	readonly to: string;
	readonly expiry: { readonly days: number };
	readonly idempotencyKey: string;
}

/** Devuelve cuántas bolsas caducaron en esta ejecución. */
export async function runFreeCreditsExpiry(deps: {
	readonly credits: Pick<Credits, 'warnExpiringBuckets' | 'expireBuckets'>;
	readonly emailOf: (userId: string) => string | null;
	readonly sendWarning: (warning: ExpiryWarning) => Promise<boolean>;
	readonly warningDays: number;
}): Promise<number> {
	for (const userId of deps.credits.warnExpiringBuckets(deps.warningDays * DAY_MS)) {
		const to = deps.emailOf(userId);
		if (to === null) continue;
		await deps.sendWarning({
			reason: 'free_expiry_warning',
			to,
			expiry: { days: deps.warningDays },
			idempotencyKey: randomUUID()
		});
	}
	return deps.credits.expireBuckets();
}
