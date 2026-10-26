// W46–W47 · auditoría contra el build con sesión de administrador (BE-FR-55, UX-13; T303): la lista muestra su título y filtra
// sin errores; un filtro sin resultados lo dice; una entrada inexistente responde 404; un usuario sin rol recibe 403; y sin sesión
// la página manda al login. El panel no tiene acciones: un POST no existe.
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, loginAsUser, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const LIST = '/admin/auditoria';

let admin: AdminSession;
let user: AdminSession;

function get(session: AdminSession, path: string) {
	return send(baseUrl, path, {
		host: session.webHost,
		headers: { accept: 'text/html', cookie: session.cookie }
	});
}

beforeAll(async () => {
	admin = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_auditoria_admin',
		email: 'admin.auditoria.http@ejemplo.es',
		password: 'contraseña-auditoria-http-123'
	});
	user = await loginAsUser(baseUrl, databasePath, {
		id: 'usr_http_auditoria_usuario',
		email: 'usuario.auditoria.http@ejemplo.es',
		password: 'contraseña-auditoria-usuario-123'
	});
});

describe('auditoría del panel (W46–W47, T303)', () => {
	it('la lista carga con su título y acepta filtros por entidad, acción y día', async () => {
		const result = await get(
			admin,
			`${LIST}?entidad=alert&accion=notifications.mistral_billing.set&desde=2026-10-01&hasta=2026-10-31&pagina=1`
		);

		expect(result.status).toBe(200);
		expect(result.text).toContain('Auditoría');
	});

	it('un filtro sin resultados lo indica', async () => {
		const result = await get(admin, `${LIST}?accion=inventada.accion.que.no.existe`);

		expect(result.status).toBe(200);
		expect(result.text).toContain('No hay entradas con estos filtros.');
	});

	it('una fecha que no es válida se ignora en lugar de romper la lista', async () => {
		const result = await get(admin, `${LIST}?desde=no-es-fecha&hasta=2026-13-45&pagina=-4`);

		expect(result.status).toBe(200);
	});

	it('una entrada que no existe responde 404', async () => {
		const result = await get(admin, `${LIST}/aud_inexistente`);

		expect(result.status).toBe(404);
	});

	it('un usuario sin rol de administrador no ve la auditoría', async () => {
		const result = await get(user, LIST);

		expect(result.status).toBe(403);
	});

	it('el panel no tiene acciones: un envío a la lista no modifica nada', async () => {
		const result = await postAdmin(admin, LIST, 'accion=borrar');

		expect(result.status).toBeGreaterThanOrEqual(400);
	});
});
