// Presentadores de `accounts` (T258; BE-FR-49.2–49.4): la forma que ve el panel de una sesión. Nunca el token, ni el
// agente de usuario, ni la IP exacta (solo la aproximada), ni el usuario.
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import type { SessionView } from './sessions';

export interface SessionDto {
	readonly id: string;
	readonly current: boolean;
	readonly createdOn: string;
	readonly lastUsedOn: string | null;
	readonly deviceName: string;
	readonly approxIp: string;
}

/** Vista de una sesión del panel W26. `currentId` es la sesión que hace la petición. */
export function sessionDtoOf(item: SessionView, currentId: string | null): SessionDto {
	return {
		id: item.id,
		current: item.id === currentId,
		createdOn: civilDateOf(item.createdAt),
		lastUsedOn: item.lastUsedAt === null ? null : civilDateOf(toEpochMs(item.lastUsedAt)),
		deviceName: item.deviceName ?? '',
		approxIp: item.approxIp ?? ''
	};
}
