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

function versionsOf(): { min: string; recommended: string; enforce: boolean } {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { min: string | null; recommended: string | null; enforce: number }>(
				'SELECT min_app_version AS min, recommended_app_version AS recommended, enforce_version AS enforce FROM apps WHERE slug = ?'
			)
			.get(SLUG);
		return {
			min: row?.min ?? '',
			recommended: row?.recommended ?? '',
			enforce: row?.enforce === 1
		};
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

	it('guardar los datos de la app sin confirmación o con un correo inválido responde 400 y no audita', async () => {
		const antes = auditCount('apps.app.update');
		const base = `nombre=Secretario&descripcion=&enlaces=${encodeURIComponent(JSON.stringify({ landing: { type: 'internal' } }))}&origenes=%5B%5D&esquemaSincronizacion=%7B%7D&motivo=Datos+de+prueba`;

		const sinConfirmar = await postAdmin(session, `/admin/apps/${SLUG}?/guardarApp`, base);
		const correoMalo = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/guardarApp`,
			`${base}&soporte=no-es-un-correo&confirmado=true`
		);

		expect(sinConfirmar.status).toBe(400);
		expect(correoMalo.status).toBe(400);
		expect(auditCount('apps.app.update')).toBe(antes);
	});

	it('guardar los datos con valores válidos responde 303 y queda auditado', async () => {
		const antes = auditCount('apps.app.update');
		const enlaces = JSON.stringify(SECRETARIO_LINKS);
		const esquema = JSON.stringify(SECRETARIO_SYNC_SCHEMA);
		const origenes = JSON.stringify(['https://secretario.mardomingo.com']);

		const aplicado = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/guardarApp`,
			new URLSearchParams({
				nombre: 'Secretario',
				descripcion: 'Asistente de IA',
				soporte: 'soporte@mardomingo.com',
				textoPostVerificacion: '',
				enlaces,
				origenes,
				esquemaSincronizacion: esquema,
				motivo: 'Datos de prueba E2E',
				confirmado: 'true'
			}).toString()
		);

		expect(aplicado.status).toBe(303);
		expect(auditCount('apps.app.update')).toBe(antes + 1);
	});

	it('crear una operación sin confirmación, con un tipo que no existe o con capacidades que no son JSON responde 400', async () => {
		const antes = auditCount('apps.operation.create');
		const base =
			'clave=prueba-http-invalida&nombre=Prueba&modelo=&grupo=&tiempoMs=45000&costeMaximoMicro=1000&motivo=Alta+de+prueba';

		const sinConfirmar = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/crearOperacion`,
			`${base}&tipo=chat&capacidades=%7B%7D`
		);
		const tipoInventado = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/crearOperacion`,
			`${base}&tipo=video&capacidades=%7B%7D&confirmado=true`
		);
		const capacidadesRotas = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/crearOperacion`,
			`${base}&tipo=chat&capacidades=no-es-json&confirmado=true`
		);

		expect(sinConfirmar.status).toBe(400);
		expect(tipoInventado.status).toBe(400);
		expect(capacidadesRotas.status).toBe(400);
		expect(auditCount('apps.operation.create')).toBe(antes);
	});

	it('guardar las versiones sin confirmación o con una versión mal formada responde 400 y no audita', async () => {
		const antes = auditCount('apps.app.versions');

		const sinConfirmar = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/guardarVersiones`,
			'versionMinima=1.0.0&motivo=Sin+confirmar'
		);
		const malFormada = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/guardarVersiones`,
			'versionMinima=uno.cero&motivo=Version+mala&confirmado=true'
		);

		expect(sinConfirmar.status).toBe(400);
		expect(malFormada.status).toBe(400);
		expect(auditCount('apps.app.versions')).toBe(antes);
	});

	it('guardar las versiones válidas responde 303 y queda auditado', async () => {
		const antes = auditCount('apps.app.versions');
		const actual = versionsOf();

		// Se guardan los valores que ya tiene la app: la prueba audita el guardado sin cambiar la versión que exigen las demás pruebas.
		const aplicado = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/guardarVersiones`,
			new URLSearchParams({
				versionMinima: actual.min,
				versionRecomendada: actual.recommended,
				exigirVersion: actual.enforce ? 'true' : 'false',
				motivo: 'Versiones+de+prueba',
				confirmado: 'true'
			}).toString()
		);

		expect(aplicado.status).toBe(303);
		expect(auditCount('apps.app.versions')).toBe(antes + 1);
	});
});
