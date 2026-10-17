// Dos clientes simulados de una misma cuenta y app (T219): cada uno lee, guarda la revisión que leyó y escribe con
// `If-Match`. Hablan con el servicio de `sync` directamente, como lo harían las rutas, sin HTTP.
import { getSyncDocument, putSyncDocument, type SyncDeps } from '$lib/server/features/sync';
import { AppError } from '$lib/server/shared/errors';

export interface SyncClient {
	/** Lee el documento y recuerda su revisión para el siguiente `write`. */
	read(): { readonly revision: number; readonly data: Record<string, unknown> };
	/** Escribe con la última revisión leída. Devuelve la nueva revisión o el código de error (p. ej. `SYNC_CONFLICT`). */
	write(
		data: Record<string, unknown>
	):
		| { readonly ok: true; readonly revision: number }
		| { readonly ok: false; readonly code: string };
}

export function syncClient(deps: SyncDeps, userId: string, appId: string): SyncClient {
	let known: number | null = null;
	return {
		read() {
			const document = getSyncDocument(deps, { userId, appId });
			known = document.revision;
			return { revision: document.revision, data: { ...document.data } };
		},
		write(data) {
			if (known === null) throw new Error('el cliente debe leer antes de escribir');
			try {
				const result = putSyncDocument(deps, { userId, appId, ifMatch: known, data });
				known = result.revision;
				return { ok: true, revision: result.revision };
			} catch (error) {
				if (error instanceof AppError) return { ok: false, code: error.code };
				throw error;
			}
		}
	};
}
