// C-54 (T445; UX-13, BE-FR-55): las acciones auditadas de W39–W40 (`/admin/apps` y su ficha) vuelven con
// `?aviso=saved&auditoria=<id>` y la página enlaza con esa entrada. Todo se hace sobre una app propia de la prueba, que se
// deshabilita al terminar: `secretario` no cambia.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const SLUG = 'c54-enlace';
const PAGE = `/admin/apps/${SLUG}`;
const LINKS = JSON.stringify({ landing: { type: 'internal' } });
const SYNC_SCHEMA = JSON.stringify({ categories: { notas: { strategy: 'block' } } });

let session: AdminSession;

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_c54_apps',
		email: 'admin.c54.apps@ejemplo.es',
		password: 'contraseña-c54-apps-123'
	});
});

afterAll(() => {
	const db = new Database(databasePath);
	try {
		db.prepare("UPDATE apps SET status = 'disabled' WHERE slug = ?").run(SLUG);
	} finally {
		db.close();
	}
});

describe('C-54 · W39–W40 enlazan cada cambio con su entrada de auditoría (UX-13)', () => {
	it('dar de alta una app vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			slug: SLUG,
			nombre: 'App de C-54',
			descripcion: 'App de prueba del enlace a la auditoría',
			tiposCliente: JSON.stringify(['web']),
			enlaces: LINKS,
			esquemaSincronizacion: SYNC_SCHEMA,
			origenes: '[]',
			soporte: '',
			confirmado: 'true'
		});

		const result = await postAdmin(session, '/admin/apps?/crearApp', body.toString());

		await expectAuditLink(session, databasePath, result, 'apps.app.create');
	});

	it('guardar los datos de la app vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			nombre: 'App de C-54',
			descripcion: 'App de prueba del enlace a la auditoría',
			soporte: '',
			textoPostVerificacion: '',
			enlaces: LINKS,
			origenes: '[]',
			esquemaSincronizacion: SYNC_SCHEMA,
			motivo: 'Datos revisados',
			confirmado: 'true'
		});

		const result = await postAdmin(session, `${PAGE}?/guardarApp`, body.toString());

		await expectAuditLink(session, databasePath, result, 'apps.app.update');
	});

	it('guardar las versiones vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`${PAGE}?/guardarVersiones`,
			'versionMinima=1.0.0&versionRecomendada=1.0.0&exigirVersion=false&motivo=Versiones+revisadas&confirmado=true'
		);

		await expectAuditLink(session, databasePath, result, 'apps.app.versions');
	});

	it('guardar el mantenimiento vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`${PAGE}?/guardarMantenimiento`,
			'activo=false&mensaje=&motivo=Sin+mantenimiento&confirmado=true'
		);

		await expectAuditLink(session, databasePath, result, 'apps.maintenance.update');
	});

	it('guardar las sobrescrituras vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`${PAGE}?/guardarSobrescrituras`,
			'sobrescrituras=%7B%7D&motivo=Sin+sobrescrituras&confirmado=true'
		);

		await expectAuditLink(session, databasePath, result, 'apps.settings.update');
	});

	it('dar de alta una operación vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			clave: 'c54-operacion',
			nombre: 'Operación de C-54',
			// El formulario no pide tokens de salida ni configuración de transcripción: solo `image` se puede dar de alta desde W40.
			tipo: 'image',
			modelo: '',
			grupo: '',
			tiempoMs: '30000',
			costeMaximoMicro: '1000000',
			capacidades: JSON.stringify({ image_input: false, structured_output: false, tools: false }),
			confirmado: 'true'
		});

		const result = await postAdmin(session, `${PAGE}?/crearOperacion`, body.toString());

		await expectAuditLink(session, databasePath, result, 'apps.operation.create');
	});
});
