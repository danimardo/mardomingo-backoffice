// Lectura de las alertas activas para el panel de administración (W33; T304). Solo lectura de `alerts_state`.
import { desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { alertsState } from './schema';

export interface ActiveAlert {
	readonly key: string;
	readonly lastSentAt: number | null;
	readonly updatedAt: number;
}

export function activeAlerts(db: Pick<Db, 'select'>): ActiveAlert[] {
	return db
		.select({
			key: alertsState.key,
			lastSentAt: alertsState.lastSentAt,
			updatedAt: alertsState.updatedAt
		})
		.from(alertsState)
		.where(eq(alertsState.active, true))
		.orderBy(desc(alertsState.updatedAt))
		.all();
}
