// S-04 · Un GET o PUT de /sync que pasó la sesión antes del borrado de la cuenta vuelve a crear el documento después del
// borrado (BE-FR-07 CA1: se borran los documentos sincronizados; RGPD art. 17). `getSyncDocument` y `putSyncDocument`
// (sync/service.ts:87-141) no comprueban en su transacción que la cuenta siga viva: la ruta PUT valida la sesión y después
// hace `await jsonBodyOf(...)` (api/v1/sync/+server.ts:33-49), y en ese hueco puede confirmarse `deleteAccount`. Nada borra
// después ese documento (la retención no mira `sync_documents`). Aquí se simula el orden: borrado confirmado y, a continuación,
// la llamada al servicio de la petición que ya había pasado la sesión.
// Corrección (C-43, T435): los triggers de la migración 0019 abortan la escritura y `sync` responde `UNAUTHENTICATED`.
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	PRIVACY_PASSWORD,
	privacyFixture,
	type PrivacyFixture
} from '../../../../../tests/builders/privacy';
import { AppError } from '$lib/server/shared/errors';
import { getSyncDocument, putSyncDocument, syncDocuments } from '../sync';

let f: PrivacyFixture;

beforeEach(async () => {
	f = await privacyFixture();
});

afterEach(() => {
	f.close();
});

function documentsOf(userId: string, appId: string) {
	return f.panel.fixture.base.db
		.select()
		.from(syncDocuments)
		.where(and(eq(syncDocuments.userId, userId), eq(syncDocuments.appId, appId)))
		.all();
}

describe('sincronización en curso durante el borrado de la cuenta (S-04, BE-FR-07 CA1)', () => {
	it('un PUT que llega tras el borrado no deja el documento de la cuenta borrada', async () => {
		const userId = f.otherUserId;
		const outcome = await f.privacy.deleteAccount({
			userId,
			reason: 'user',
			password: PRIVACY_PASSWORD
		});
		expect(outcome.status).toBe('deleted');
		expect(documentsOf(userId, f.secondAppId)).toHaveLength(0);

		try {
			putSyncDocument(f.deps.sync, {
				userId,
				appId: f.secondAppId,
				ifMatch: 1,
				data: { notas: { value: 'dato personal tras el borrado', updatedAt: 1 } }
			});
		} catch {
			// Se acepta que rechace; lo que no puede es guardar.
		}

		expect(documentsOf(userId, f.secondAppId)).toHaveLength(0);
	});

	it('un GET que llega tras el borrado no siembra un documento nuevo', async () => {
		const userId = f.otherUserId;
		await f.privacy.deleteAccount({ userId, reason: 'user', password: PRIVACY_PASSWORD });

		try {
			getSyncDocument(f.deps.sync, { userId, appId: f.secondAppId });
		} catch {
			// Se acepta que rechace.
		}

		expect(documentsOf(userId, f.secondAppId)).toHaveLength(0);
	});

	it('la petición rechazada ve una sesión que ya no existe (UNAUTHENTICATED), no un error interno', async () => {
		const userId = f.otherUserId;
		await f.privacy.deleteAccount({ userId, reason: 'user', password: PRIVACY_PASSWORD });

		const codes = [
			() => getSyncDocument(f.deps.sync, { userId, appId: f.secondAppId }),
			() =>
				putSyncDocument(f.deps.sync, {
					userId,
					appId: f.secondAppId,
					ifMatch: 1,
					data: { notas: { value: 'tras el borrado', updatedAt: 1 } }
				})
		].map((run) => {
			try {
				run();
				return 'sin error';
			} catch (error) {
				return error instanceof AppError ? error.code : 'otro';
			}
		});

		expect(codes).toEqual(['UNAUTHENTICATED', 'UNAUTHENTICATED']);
	});
});
