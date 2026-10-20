// W41 · operación de IA contra el build con sesión de administrador (BE-FR-77, BE-FR-78; T311): sin confirmación nada cambia; activar
// sin un modelo compatible se rechaza con 400 y la operación sigue inactiva; una plantilla que no es JSON y unos ajustes fuera de rango
// responden 400 sin auditoría. La operación de prueba se deja como estaba sembrada (inactiva).
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const SLUG = 'secretario';
const KEY = 'improve';
const PAGE = `/admin/apps/${SLUG}/operaciones/${KEY}`;

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

function operationActive(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { active: number }>('SELECT active FROM app_operations WHERE key = ?')
			.get(KEY);
		return row?.active ?? -1;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_operacion_admin',
		email: 'admin.operacion.http@ejemplo.es',
		password: 'contraseña-operacion-http-123'
	});
});

describe('operación de IA con sesión de administrador (W41, T311)', () => {
	it('la ficha de la operación responde 200 con su clave', async () => {
		const result = await send(baseUrl, PAGE, {
			host: session.webHost,
			headers: { accept: 'text/html', cookie: session.cookie }
		});

		expect(result.status).toBe(200);
		expect(result.text).toContain(KEY);
	});

	it('activar sin confirmación no cambia la operación', async () => {
		const antes = auditCount('apps.operation.activate');
		const activaAntes = operationActive();

		const result = await postAdmin(session, `${PAGE}?/activar`, 'motivo=Sin+confirmar');

		expect(result.status).toBe(400);
		expect(operationActive()).toBe(activaAntes);
		expect(auditCount('apps.operation.activate')).toBe(antes);
	});

	it('activar sin un modelo compatible se rechaza y la operación sigue inactiva', async () => {
		const antes = auditCount('apps.operation.activate');
		const activaAntes = operationActive();

		const result = await postAdmin(
			session,
			`${PAGE}?/activar`,
			'motivo=Activar+sin+modelo&confirmado=true'
		);

		expect(result.status).toBe(400);
		expect(operationActive()).toBe(activaAntes);
		expect(auditCount('apps.operation.activate')).toBe(antes);
	});

	it('una plantilla que no es JSON responde 400 sin versionar nada', async () => {
		const antes = auditCount('apps.template.version');

		const result = await postAdmin(
			session,
			`${PAGE}?/guardarPlantilla`,
			'plantilla=no-es-json&motivo=Plantilla+de+prueba&confirmado=true'
		);

		expect(result.status).toBe(400);
		expect(auditCount('apps.template.version')).toBe(antes);
	});

	it('unos ajustes fuera de rango responden 400 y no se auditan', async () => {
		const antes = auditCount('apps.operation.settings');

		const result = await postAdmin(
			session,
			`${PAGE}?/guardarOperacion`,
			'tiempoMs=-1&tokensSalida=&temperaturaMilli=0&costeMaximoMicro=0&motivo=Fuera+de+rango&confirmado=true'
		);

		expect(result.status).toBe(400);
		expect(auditCount('apps.operation.settings')).toBe(antes);
	});
});
