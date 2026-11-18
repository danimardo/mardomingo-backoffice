// A-05 · Varias acciones auditadas no enlazan con su entrada de auditoría al guardar (UX-13, Historias.md 16: «Al guardar, se
// enlaza la entrada de auditoría», y nombra el reembolso y el cierre de sesiones; contracts/web-routes.md §4: «toda action que
// modifica datos ... redirige con `?aviso=saved&auditoria=<entryId>`»). Solo bloquear, desbloquear, tester y el ajuste usan
// `savedRedirect`. Sin enlace: cerrarSesiones (usuarios/[userId]/+page.server.ts:276-277), reembolso (`?aviso=reembolso_aplicado`,
// reembolso/+page.server.ts:162-164), economía (138, 154, 169, 187), protecciones (91, 124, 134), apps, operación, anuncios,
// legal y predeterminados. Los servicios afectados no devuelven el id de la entrada (`closeUserSessions` devuelve el número
// de sesiones; `setManualFx`, `updateSetting`, etc. devuelven `void`).
//
// Destino en el repo: tests/http/admin-enlace-auditoria.test.ts
// Ejecutar: pnpm build; pnpm exec vitest run --project http tests/http/admin-enlace-auditoria.test.ts
// Debe FALLAR hoy: las dos redirecciones no llevan `aviso=saved` ni `auditoria=`.
// Nota: el tipo manual se fija a 920000 ppm (el valor por defecto) para no cambiar el cobro de las demás pruebas HTTP.
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const TARGET_ID = 'usr_http_a05_objetivo';

let admin: AdminSession;

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(TARGET_ID, 'objetivo.a05@ejemplo.es', 'objetivo.a05@ejemplo.es', Date.now(), Date.now());
	} finally {
		db.close();
	}
	admin = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_a05_admin',
		email: 'admin.a05.http@ejemplo.es',
		password: 'contraseña-a05-http-123'
	});
});

function locationOf(headers: Readonly<Record<string, string | string[] | undefined>>): string {
	return String(headers.location ?? '');
}

describe('A-05 · las acciones auditadas enlazan con su entrada de auditoría (UX-13)', () => {
	it('cerrar sesiones redirige con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			admin,
			`/admin/usuarios/${TARGET_ID}?/cerrarSesiones`,
			'confirmado=true&motivo=Revisi%C3%B3n+de+seguridad&sesion='
		);

		expect(result.status).toBe(303);
		expect(locationOf(result.headers)).toContain('aviso=saved');
		expect(locationOf(result.headers)).toMatch(/auditoria=aud_[A-Za-z0-9_-]+/);
	});

	it('fijar el tipo de cambio manual redirige con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			admin,
			'/admin/economia?/fijarTipoCambioManual',
			'confirmado=true&usdEurPpm=920000&motivo=Tipo+de+la+gestor%C3%ADa'
		);

		expect(result.status).toBe(303);
		expect(locationOf(result.headers)).toContain('aviso=saved');
		expect(locationOf(result.headers)).toMatch(/auditoria=aud_[A-Za-z0-9_-]+/);
	});
});
