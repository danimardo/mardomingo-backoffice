// W39–W40 · apps contra el build con sesión de administrador (BE-FR-47, BE-FR-52, BE-FR-62; T310): un slug ya usado responde 409, la
// vista previa del mantenimiento no cambia nada, activar el mantenimiento exige confirmación, motivo y mensaje, y el cambio confirmado
// se aplica y queda auditado. El mantenimiento se desactiva al terminar para no alterar a otras pruebas de la base.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import {
	SECRETARIO_LINKS,
	SECRETARIO_SYNC_SCHEMA
} from '../../src/lib/server/features/apps/defaults';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const SLUG = 'secretario';
const ACTION = `/admin/apps/${SLUG}?/guardarMantenimiento`;
const PREVIEW = `/admin/apps/${SLUG}?/previsualizarMantenimiento`;

let session: AdminSession;

function auditCount(action: string): number {
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

function maintenanceActive(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { active: number }>(
				'SELECT maintenance_active AS active FROM apps WHERE slug = ?'
			)
			.get(SLUG);
		return row?.active ?? -1;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_apps_admin',
		email: 'admin.apps.http@ejemplo.es',
		password: 'contraseña-apps-http-123'
	});
});

afterAll(async () => {
	await postAdmin(
		session,
		ACTION,
		'activo=false&mensaje=&motivo=Fin+del+mantenimiento+de+prueba&confirmado=true'
	);
});

describe('apps con sesión de administrador (W39–W40, T310)', () => {
	it('dar de alta una app con un slug ya usado responde 409 SLUG_TAKEN', async () => {
		const result = await postAdmin(
			session,
			'/admin/apps?/crearApp',
			new URLSearchParams({
				slug: SLUG,
				nombre: 'Duplicada',
				descripcion: '',
				tiposCliente: JSON.stringify(['web']),
				enlaces: JSON.stringify(SECRETARIO_LINKS),
				esquemaSincronizacion: JSON.stringify(SECRETARIO_SYNC_SCHEMA),
				origenes: JSON.stringify(['https://ejemplo.es']),
				soporte: '',
				confirmado: 'true'
			}).toString()
		);

		expect(result.status).toBe(409);
	});

	it('la vista previa del mantenimiento muestra el cambio y no lo aplica', async () => {
		const antes = maintenanceActive();

		const preview = await postAdmin(session, PREVIEW, 'activo=true&mensaje=Volvemos+enseguida');

		expect(preview.status).toBe(200);
		expect(preview.text).toContain('Vista previa del mantenimiento');
		expect(maintenanceActive()).toBe(antes);
	});

	it('activar el mantenimiento sin confirmación, o sin mensaje, responde 400 y no cambia nada', async () => {
		const antes = auditCount('apps.maintenance.update');

		const sinConfirmar = await postAdmin(
			session,
			ACTION,
			'activo=true&mensaje=Volvemos&motivo=Sin+confirmar'
		);
		const sinMensaje = await postAdmin(
			session,
			ACTION,
			'activo=true&mensaje=&motivo=Sin+mensaje&confirmado=true'
		);

		expect(sinConfirmar.status).toBe(400);
		expect(sinMensaje.status).toBe(400);
		expect(maintenanceActive()).toBe(0);
		expect(auditCount('apps.maintenance.update')).toBe(antes);
	});

	it('activar el mantenimiento confirmado lo aplica y queda auditado', async () => {
		const antes = auditCount('apps.maintenance.update');

		const aplicado = await postAdmin(
			session,
			ACTION,
			'activo=true&mensaje=Volvemos+enseguida&motivo=Mantenimiento+de+prueba&confirmado=true'
		);

		expect(aplicado.status).toBe(303);
		expect(maintenanceActive()).toBe(1);
		expect(auditCount('apps.maintenance.update')).toBe(antes + 1);
	});
});
