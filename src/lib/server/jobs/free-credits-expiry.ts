// Tarea `free-credits-expiry` (BE-FR-16, FR-026; T330): primero avisa por email de las bolsas gratuitas que caducan dentro de
// `free_expiry_warning_days` y después aplica las caducidades vencidas. El aviso sale una sola vez por bolsa (la marca lo hace
// `credits`); un fallo de envío no detiene la caducidad.
import { randomUUID } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import { emailOfUser } from '$lib/server/features/accounts';
import type { Credits } from '$lib/server/features/credits';
import { sendAccountEmail, type NotificationsDeps } from '$lib/server/features/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Devuelve cuántas bolsas caducaron en esta ejecución. */
export async function runFreeCreditsExpiry(deps: {
	readonly db: Db;
	readonly credits: Pick<Credits, 'warnExpiringBuckets' | 'expireBuckets'>;
	readonly notifications: NotificationsDeps;
	readonly warningDays: number;
}): Promise<number> {
	for (const userId of deps.credits.warnExpiringBuckets(deps.warningDays * DAY_MS)) {
		const to = emailOfUser(deps.db, userId);
		if (to === null) continue;
		await sendAccountEmail(deps.notifications, {
			reason: 'free_expiry_warning',
			to,
			expiry: { days: deps.warningDays },
			idempotencyKey: randomUUID()
		});
	}
	return deps.credits.expireBuckets();
}
