// Opciones del selector de app de los filtros del panel (W22, W24): solo las apps que la cuenta ha usado (BE-FR-49.3, D-13).
// Vacío significa «todas las apps». La lista sale ordenada por nombre.
import type { Composition } from '$lib/server/composition';
import { appsUsedBy } from '$lib/server/features/accounts';
import { appNamesOf } from '$lib/server/features/apps';

export interface AppOption {
	readonly value: string;
	readonly label: string;
}

export function usedAppOptionsOf(
	composition: Pick<Composition, 'db' | 'apps'>,
	userId: string
): AppOption[] {
	const ids = [...appsUsedBy(composition.db, userId)];
	const names = appNamesOf(composition.apps, ids);
	return ids
		.map((id) => ({ value: id, label: names.get(id) ?? id }))
		.sort((left, right) => left.label.localeCompare(right.label));
}
