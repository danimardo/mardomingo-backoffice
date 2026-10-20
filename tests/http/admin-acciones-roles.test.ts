// Matriz de acciones de administración contra el build (BE-FR-55, BE-FR-10; T321): cada una de las 34 acciones de W35–W49 responde
// 303 al login sin sesión y 403 con una cuenta normal, y ninguna cambia nada. Es la columna «sin sesión / rol incorrecto» de la matriz;
// los casos de motivo ausente y de persistencia fallida los cubren las pruebas HTTP de cada ruta y los tests de servicio.
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsUser, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');

const ACTIONS: readonly (readonly [string, string])[] = [
	['/admin/anuncios', 'previsualizar'],
	['/admin/anuncios', 'guardar'],
	['/admin/anuncios', 'crear'],
	['/admin/anuncios', 'desactivar'],
	['/admin/apps', 'crearApp'],
	['/admin/apps/secretario', 'previsualizarMantenimiento'],
	['/admin/apps/secretario', 'guardarMantenimiento'],
	['/admin/apps/secretario', 'guardarSobrescrituras'],
	['/admin/apps/secretario/operaciones/improve', 'activar'],
	['/admin/apps/secretario/operaciones/improve', 'desactivar'],
	['/admin/apps/secretario/operaciones/improve', 'guardarPlantilla'],
	['/admin/apps/secretario/operaciones/improve', 'guardarOperacion'],
	['/admin/apps/secretario/operaciones/improve', 'previsualizarGrupo'],
	['/admin/apps/secretario/operaciones/improve', 'aplicarAlGrupo'],
	['/admin/apps/secretario/predeterminados', 'guardarPredeterminados'],
	['/admin/apps/secretario/predeterminados/copiar', 'copiar'],
	['/admin/economia', 'previsualizarParametros'],
	['/admin/economia', 'guardarParametros'],
	['/admin/economia', 'fijarTipoCambioManual'],
	['/admin/economia', 'quitarTipoCambioManual'],
	['/admin/economia', 'guardarPrecioOrientativo'],
	['/admin/legal', 'publicar'],
	['/admin/protecciones', 'previsualizarLimites'],
	['/admin/protecciones', 'guardarLimites'],
	['/admin/protecciones', 'liberarFreno'],
	['/admin/usuarios/usr_matriz_objetivo', 'previsualizar'],
	['/admin/usuarios/usr_matriz_objetivo', 'bloquear'],
	['/admin/usuarios/usr_matriz_objetivo', 'desbloquear'],
	['/admin/usuarios/usr_matriz_objetivo', 'tester'],
	['/admin/usuarios/usr_matriz_objetivo', 'cerrarSesiones'],
	['/admin/usuarios/usr_matriz_objetivo/ajuste', 'previsualizarAjuste'],
	['/admin/usuarios/usr_matriz_objetivo/ajuste', 'ajustarSaldo'],
	['/admin/usuarios/usr_matriz_objetivo/pagos/pay_matriz/reembolso', 'previsualizarReembolso'],
	['/admin/usuarios/usr_matriz_objetivo/pagos/pay_matriz/reembolso', 'reembolsar']
];

let user: AdminSession;
let auditBefore = 0;

function auditTotal(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		return db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit').get()?.n ?? 0;
	} finally {
		db.close();
	}
}
let anonymous: AdminSession;

beforeAll(async () => {
	user = await loginAsUser(baseUrl, databasePath, {
		id: 'usr_http_matriz_normal',
		email: 'cuenta.normal.matriz@ejemplo.es',
		password: 'contraseña-matriz-http-123'
	});
	anonymous = { baseUrl, webHost: user.webHost, webOrigin: user.webOrigin, cookie: '' };
	auditBefore = auditTotal();
});

describe('acciones de administración: sin sesión y rol incorrecto (T321)', () => {
	it('la matriz cubre las 34 acciones de W35–W49', () => {
		expect(ACTIONS).toHaveLength(34);
	});

	it.each(ACTIONS)('%s?/%s sin sesión manda al login (303)', async (path, action) => {
		const result = await postAdmin(
			anonymous,
			`${path}?/${action}`,
			'motivo=Sin+sesion&confirmado=true'
		);

		expect(result.status).toBe(303);
	});

	it.each(ACTIONS)('%s?/%s con una cuenta normal responde 403', async (path, action) => {
		const result = await postAdmin(
			user,
			`${path}?/${action}`,
			'motivo=Rol+incorrecto&confirmado=true'
		);

		expect(result.status).toBe(403);
	});

	it('ninguna acción rechazada escribe auditoría', () => {
		expect(auditTotal()).toBe(auditBefore);
	});
});
