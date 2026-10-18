// Lectura de los paquetes de crédito para la administración (W38; T309). Solo lectura: incluye los inactivos, que no se venden.
// La edición queda fuera de esta fase: cambiar un paquete cambia lo que cobra el cliente (decisión de alcance).
import { asc } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { packs } from './schema';

export interface AdminPackRow {
	readonly id: string;
	readonly name: string;
	readonly priceEurCents: number;
	readonly bonusPpm: number;
	readonly active: boolean;
	readonly sortOrder: number;
}

export function listPacksForAdmin(deps: { readonly db: Db }): AdminPackRow[] {
	return deps.db
		.select({
			id: packs.id,
			name: packs.name,
			priceEurCents: packs.priceEurCents,
			bonusPpm: packs.bonusPpm,
			active: packs.active,
			sortOrder: packs.sortOrder
		})
		.from(packs)
		.orderBy(asc(packs.sortOrder))
		.all();
}
