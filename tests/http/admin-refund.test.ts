// Reembolso de W37 contra el build con sesión de administrador (BE-FR-27, 15.12; T308). Una compra que no existe responde 404 en
// las dos acciones: un `fail()` vuelve a cargar la página y su `load` comprueba la compra. El 400 por falta de confirmación y el
// reembolso con compra pagada no se pueden probar aquí sin sembrar una compra real; los cubren `refund-chargeback.int.test.ts`
// (servicio) y el E2E pendiente de T308 (ruta).
import Database from 'better-sqlite3';
import { inject, describe, expect, it, beforeAll } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const TARGET_ID = 'usr_http_reembolso_objetivo';
const PAYMENT_ID = 'pay_http_inexistente';

let session: AdminSession;

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(
			TARGET_ID,
			'reembolso.http@ejemplo.es',
			'reembolso.http@ejemplo.es',
			Date.now(),
			Date.now()
		);
	} finally {
		db.close();
	}
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_reembolso_admin',
		email: 'admin.reembolso.http@ejemplo.es',
		password: 'contraseña-reembolso-http-123'
	});
});

const ruta = `/admin/usuarios/${TARGET_ID}/pagos/${PAYMENT_ID}/reembolso`;

describe('reembolso con sesión de administrador (W37, T308)', () => {
	it('reembolsar una compra que no existe responde 404 y no reembolsa nada', async () => {
		const result = await postAdmin(
			session,
			`${ruta}?/reembolsar`,
			'importe=500&motivo=Cobro+duplicado'
		);

		expect(result.status).toBe(404);
	});

	it('la vista previa de una compra que no existe responde 404', async () => {
		const result = await postAdmin(
			session,
			`${ruta}?/previsualizarReembolso`,
			'importe=500&motivo=Cobro+duplicado'
		);

		expect(result.status).toBe(404);
	});
});
