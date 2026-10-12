// Contrato de `sync` (api-v1 E10–E12, BE-FR-41, D-19; T216). `If-Match` es obligatorio en `PUT /sync` y se lee como entero
// seguro; el cuerpo es `{ data }` y el esquema concreto se valida después, con el de la app.
import * as z from 'zod';

const IF_MATCH = /^\d+$/;

/** Lee `If-Match` como revisión. Ausente o mal formada → `null` (el llamador responde `VALIDATION_ERROR` con `field`). */
export function parseIfMatch(header: string | null): number | null {
	if (header === null || !IF_MATCH.test(header)) return null;
	const revision = Number(header);
	return Number.isSafeInteger(revision) ? revision : null;
}

export const PutSyncBody = z.strictObject({ data: z.record(z.string(), z.unknown()) });
export type PutSyncBody = z.infer<typeof PutSyncBody>;

export const GetSyncResponse = z.object({
	revision: z.int().min(1),
	data: z.record(z.string(), z.unknown())
});

export const PutSyncResponse = z.object({ revision: z.int().min(1) });

export const DefaultsResponse = z.object({ data: z.record(z.string(), z.unknown()) });
