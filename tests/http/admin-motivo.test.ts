// Motivo ausente en las acciones de administración que escriben (BE-FR-55, UX-13; T321): con sesión de administrador y el motivo vacío,
// cada acción responde 400 y no deja auditoría. Las vistas previas no escriben y no entran. La cobertura de rol y sin sesión está en
// admin-acciones-roles.test.ts; los datos completos de cada acción, en sus pruebas propias.
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');

// Fuera de la matriz, a propósito: `anuncios desactivar` y `operaciones desactivar` no exigen motivo en su servicio (decisión pendiente);
// `tester` no lo exige en BE-FR-50; `reembolsar` necesita una compra pagada que no existe en esta base (responde 404 antes de mirar el motivo).
const MUTACIONES: readonly (readonly [string, string])[] = [
	['/admin/anuncios', 'guardar'],
	['/admin/anuncios', 'crear'],
	['/admin/apps', 'crearApp'],
	['/admin/apps/secretario', 'guardarMantenimiento'],
	['/admin/apps/secretario', 'guardarSobrescrituras'],
	['/admin/apps/secretario/operaciones/improve', 'activar'],
	['/admin/apps/secretario/operaciones/improve', 'guardarPlantilla'],
	['/admin/apps/secretario/operaciones/improve', 'guardarOperacion'],
	['/admin/apps/secretario/operaciones/improve', 'aplicarAlGrupo'],
	['/admin/apps/secretario/predeterminados', 'guardarPredeterminados'],
	['/admin/apps/secretario/predeterminados/copiar', 'copiar'],
	['/admin/economia', 'guardarParametros'],
	['/admin/economia', 'fijarTipoCambioManual'],
	['/admin/economia', 'quitarTipoCambioManual'],
	['/admin/economia', 'guardarPrecioOrientativo'],
	['/admin/legal', 'publicar'],
	['/admin/protecciones', 'guardarLimites'],
	['/admin/protecciones', 'liberarFreno'],
	['/admin/usuarios/usr_matriz_objetivo', 'bloquear'],
	['/admin/usuarios/usr_matriz_objetivo', 'desbloquear'],
	['/admin/usuarios/usr_matriz_objetivo', 'cerrarSesiones'],
	['/admin/usuarios/usr_matriz_objetivo/ajuste', 'ajustarSaldo'],
	['/admin/anuncios', 'desactivar'],
	['/admin/apps/secretario/operaciones/improve', 'desactivar'],
	['/admin/usuarios/usr_matriz_objetivo', 'tester']
];

let session: AdminSession;

function auditTotal(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		return db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit').get()?.n ?? 0;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		const ahora = Date.now();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES ('usr_matriz_objetivo', '', 'objetivo.motivo@ejemplo.es', 1, 'user', 0, 'objetivo.motivo@ejemplo.es', ?, ?)`
		).run(ahora, ahora);
	} finally {
		db.close();
	}
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_motivo_admin',
		email: 'admin.motivo.http@ejemplo.es',
		password: 'contraseña-motivo-http-123'
	});
});

describe('motivo ausente en las acciones que escriben (T321)', () => {
	it.each(MUTACIONES)('%s?/%s con el motivo vacío responde 400', async (path, action) => {
		const antes = auditTotal();
		const result = await postAdmin(session, `${path}?/${action}`, 'motivo=&confirmado=true');

		expect(result.status).toBe(400);
		expect(auditTotal()).toBe(antes);
	});

	it('desactivar un anuncio sin confirmación responde 400 y no audita', async () => {
		const antes = auditTotal();
		const result = await postAdmin(
			session,
			'/admin/anuncios?/desactivar',
			'anuncioId=ann_inexistente&motivo=Sin+confirmar'
		);

		expect(result.status).toBe(400);
		expect(auditTotal()).toBe(antes);
	});
});
