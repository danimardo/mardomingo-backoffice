// W44 · límites de protección contra el build con sesión de administrador (BE-FR-43, BE-FR-46, BE-FR-53; T313): la vista previa no
// cambia nada, una clave desconocida o un valor fuera de rango se rechazan, un cambio sin confirmación no se aplica, y un cambio
// confirmado se aplica, se muestra y queda auditado. El límite se restaura al terminar.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const KEY = 'login_max_failures';
const DEFAULT_VALUE = '10';
const CHANGED_VALUE = '12';
const ACTION = '/admin/protecciones?/guardarLimites';
const PREVIEW = '/admin/protecciones?/previsualizarLimites';

let session: AdminSession;

function auditCount(action = 'apps.setting.update'): number {
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

async function pageHtml(): Promise<string> {
	const result = await send(baseUrl, '/admin/protecciones', {
		host: session.webHost,
		headers: { accept: 'text/html', cookie: session.cookie }
	});
	return result.text;
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_protecciones_admin',
		email: 'admin.protecciones.http@ejemplo.es',
		password: 'contraseña-protecciones-http-123'
	});
});

afterAll(async () => {
	await postAdmin(
		session,
		ACTION,
		`clave=${KEY}&valor=${DEFAULT_VALUE}&motivo=Restaurar+limite+de+prueba&confirmado=true`
	);
});

describe('límites de protección con sesión de administrador (W44, T313)', () => {
	it('la vista previa de un límite muestra el cambio y no lo aplica', async () => {
		const antes = auditCount();

		const preview = await postAdmin(session, PREVIEW, `clave=${KEY}&valor=${CHANGED_VALUE}`);

		expect(preview.status).toBe(200);
		expect(preview.text).toContain('Vista previa del límite');
		expect(auditCount()).toBe(antes);
	});

	it('una clave que no es un límite de W44 responde 400', async () => {
		const result = await postAdmin(session, PREVIEW, `clave=max_debt&valor=1`);

		expect(result.status).toBe(400);
	});

	it('un valor fuera de rango responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const negativo = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=-5&motivo=Valor+fuera+de+rango&confirmado=true`
		);

		expect(negativo.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio sin confirmación responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const sinConfirmar = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Sin+confirmar`
		);

		expect(sinConfirmar.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio confirmado se aplica, se muestra y queda auditado', async () => {
		const antes = auditCount();

		const aplicado = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Ajuste+de+limite&confirmado=true`
		);

		expect(aplicado.status).toBe(303);
		expect(auditCount()).toBe(antes + 1);
		expect(await pageHtml()).toContain(`${KEY} (`);
		expect(await pageHtml()).toContain(`: ${CHANGED_VALUE})`);
	});

	it('declarar el error de facturación de Mistral exige confirmación y motivo, y activa y limpia la alerta con su auditoría (T326)', async () => {
		const audit = auditCount('notifications.mistral_billing.set');
		const alertaActiva = (): number => {
			const db = new Database(databasePath, { readonly: true });
			try {
				return (
					db
						.prepare<[], { active: number }>(
							"SELECT active FROM alerts_state WHERE key = 'mistral_billing'"
						)
						.get()?.active ?? 0
				);
			} finally {
				db.close();
			}
		};

		const sinConfirmar = await postAdmin(
			session,
			`/admin/protecciones?/fijarAlertaMistral`,
			'error=true&motivo=Sin+confirmar'
		);
		const sinMotivo = await postAdmin(
			session,
			`/admin/protecciones?/fijarAlertaMistral`,
			'error=true&motivo=+&confirmado=true'
		);
		expect(sinConfirmar.status).toBe(400);
		expect(sinMotivo.status).toBe(400);
		expect(alertaActiva()).toBe(0);

		const declarar = await postAdmin(
			session,
			`/admin/protecciones?/fijarAlertaMistral`,
			'error=true&motivo=Factura+rechazada&confirmado=true'
		);
		expect(declarar.status).toBe(303);
		expect(alertaActiva()).toBe(1);

		const limpiar = await postAdmin(
			session,
			`/admin/protecciones?/fijarAlertaMistral`,
			'motivo=Factura+resuelta&confirmado=true'
		);
		expect(limpiar.status).toBe(303);
		expect(alertaActiva()).toBe(0);
		expect(auditCount('notifications.mistral_billing.set')).toBe(audit + 2);
	});
});
