// _Seed_ de `sync` (BE-FR-40; T211): los predeterminados de `secretario` empiezan vacíos y el administrador los rellena
// desde el panel (L13). Idempotente: solo inserta si la fila no existe; el _seed_ de `apps` no toca `app_defaults`.
import { eq } from 'drizzle-orm';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { SECRETARIO_APP_ID } from '$lib/server/features/apps';
import { appDefaults } from './schema';

export function seedSync(tx: Tx, now: EpochMs): void {
	const exists = tx
		.select({ appId: appDefaults.appId })
		.from(appDefaults)
		.where(eq(appDefaults.appId, SECRETARIO_APP_ID))
		.get();
	if (exists !== undefined) return;
	tx.insert(appDefaults).values({ appId: SECRETARIO_APP_ID, data: {}, updatedAt: now }).run();
}
