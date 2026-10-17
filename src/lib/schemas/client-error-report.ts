// Informe de error del navegador (`POST /client-errors`; contracts/log-events.md 2.4). El mensaje del error
// nunca sale del navegador: solo viajan el nombre, una huella y las líneas de la pila sin query.
import * as z from 'zod';

export const clientErrorReportSchema = z.strictObject({
	name: z.string().min(1).max(100),
	fingerprint: z.string().regex(/^[0-9a-f]{8}$/),
	frames: z.array(z.string().max(300)).max(20),
	routeId: z.string().max(200).optional(),
	version: z.string().max(40),
	count: z.int().min(1).max(10_000)
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;

/** Tamaño máximo del cuerpo aceptado, en bytes (W52). */
export const CLIENT_ERROR_MAX_BYTES = 4096;
