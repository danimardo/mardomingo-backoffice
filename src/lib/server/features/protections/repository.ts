// Acceso al estado del freno global (BE-FR-46; T196). El JSON se valida al leer: un valor que no cumple el esquema es un
// error interno y no se interpreta a medias.
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toCivilDate, toEpochMs, type EpochMs } from '$lib/shared/time';
import type { BrakeState } from './domain/brake';
import { protectionState } from './schema';

export const GLOBAL_BRAKE_KEY = 'global_brake';

const BrakeStateJson = z.strictObject({
	day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	active: z.boolean(),
	activatedAt: z.number().nullable(),
	releasedAt: z.number().nullable(),
	releasedBy: z.string().nullable()
});

/** Estado guardado del freno, o `null` si nunca se ha activado. */
export function readBrakeState(db: Db | Tx): BrakeState | null {
	const row = db
		.select({ value: protectionState.value })
		.from(protectionState)
		.where(eq(protectionState.key, GLOBAL_BRAKE_KEY))
		.get();
	if (row === undefined) return null;
	const parsed = BrakeStateJson.parse(row.value);
	return {
		day: toCivilDate(parsed.day),
		active: parsed.active,
		activatedAt: parsed.activatedAt === null ? null : toEpochMs(parsed.activatedAt),
		releasedAt: parsed.releasedAt === null ? null : toEpochMs(parsed.releasedAt),
		releasedBy: parsed.releasedBy
	};
}

/** Sustituye el estado del freno (una fila por clave). */
export function writeBrakeState(tx: Tx, state: BrakeState, now: EpochMs): void {
	tx.insert(protectionState)
		.values({ key: GLOBAL_BRAKE_KEY, value: state, updatedAt: now })
		.onConflictDoUpdate({
			target: protectionState.key,
			set: { value: state, updatedAt: now }
		})
		.run();
}
