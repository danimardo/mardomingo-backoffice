// Lectura de las apps para las landings públicas (T346; W01 y W02). Solo toca la tabla `apps`.
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { LandingAppRow } from './presenters';
import { appOperations, apps } from './schema';

const COLUMNS = Object.freeze({
	slug: apps.slug,
	name: apps.name,
	description: apps.description,
	status: apps.status,
	clientTypes: apps.clientTypes,
	links: apps.links,
	supportEmail: apps.supportEmail
});

/** Todas las apps, por nombre; el presentador se queda con las activas. */
export function landingRows(db: Pick<Db, 'select'>): LandingAppRow[] {
	return db.select(COLUMNS).from(apps).orderBy(asc(apps.name)).all();
}

/** Una app por su slug, desactivada incluida (la landing la muestra con su aviso). */
export function landingRowBySlug(db: Pick<Db, 'select'>, slug: string): LandingAppRow | undefined {
	return db.select(COLUMNS).from(apps).where(eq(apps.slug, slug)).get();
}

export interface PricedOperationRow {
	readonly operationId: string;
	readonly appId: string;
	readonly appName: string;
	readonly key: string;
	readonly name: string;
	readonly kind: 'chat' | 'transcription' | 'image';
}

/** Operaciones activas de apps activas, por app y por nombre: las que aparecen en los precios orientativos (W03). */
export function activeOperationsForPrices(db: Pick<Db, 'select'>): PricedOperationRow[] {
	return db
		.select({
			operationId: appOperations.id,
			appId: apps.id,
			appName: apps.name,
			key: appOperations.key,
			name: appOperations.name,
			kind: appOperations.kind
		})
		.from(appOperations)
		.innerJoin(apps, eq(apps.id, appOperations.appId))
		.where(and(eq(apps.status, 'active'), eq(appOperations.active, true)))
		.orderBy(asc(apps.name), asc(appOperations.name))
		.all();
}
