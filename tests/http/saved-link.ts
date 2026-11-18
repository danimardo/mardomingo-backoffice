// Aviso de guardado con enlace a la auditoría (UX-13; C-51, C-54): una acción auditada vuelve con `?aviso=saved&auditoria=<id>`,
// la entrada existe con la acción esperada y la página de destino enlaza con `/admin/auditoria/<id>`.
import Database from 'better-sqlite3';
import { expect } from 'vitest';
import type { AdminSession } from './admin-session';
import { send, type HttpResult } from './client';

/** Número de entradas de auditoría con esa acción. */
export function auditCount(databasePath: string, action: string): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit WHERE action = ?')
			.get(action);
		return row?.n ?? 0;
	} finally {
		db.close();
	}
}

function actionOf(databasePath: string, entryId: string): string | null {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { action: string }>('SELECT action FROM admin_audit WHERE id = ?')
			.get(entryId);
		return row?.action ?? null;
	} finally {
		db.close();
	}
}

/**
 * Comprueba que la respuesta es un 303 con `aviso=saved&auditoria=<id>`, que la entrada es de la acción esperada y que la
 * página de destino la enlaza. Devuelve el id de la entrada.
 */
export async function expectAuditLink(
	session: AdminSession,
	databasePath: string,
	result: HttpResult,
	action: string
): Promise<string> {
	expect(result.status).toBe(303);
	const location = String(result.headers.location ?? '');
	expect(location).toContain('aviso=saved');
	const entryId = /[?&]auditoria=(aud_[A-Za-z0-9_-]+)/.exec(location)?.[1] ?? '';
	expect(entryId).not.toBe('');
	expect(actionOf(databasePath, entryId)).toBe(action);
	const page = await send(session.baseUrl, location, {
		host: session.webHost,
		headers: { accept: 'text/html', cookie: session.cookie }
	});
	expect(page.status).toBe(200);
	expect(page.text).toContain(`/admin/auditoria/${entryId}`);
	return entryId;
}
