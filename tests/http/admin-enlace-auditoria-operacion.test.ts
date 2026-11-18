// C-54 (T445; UX-13, BE-FR-55): las acciones auditadas de W41 (`/admin/apps/[slug]/operaciones/[key]`) vuelven con
// `?aviso=saved&auditoria=<id>` y la página enlaza con esa entrada. Se usa una app propia con dos operaciones (una de plantilla y
// otra activa, ajustadas a mano en la base) y se deshabilita al terminar. Activar no se prueba aquí: la base HTTP no tiene un
// modelo compatible; su id de entrada lo cubre la prueba de integración de `activation`.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const SLUG = 'c54-operacion';
const TEMPLATE_KEY = 'c54-plantilla';
const ACTIVE_KEY = 'c54-activa';

let session: AdminSession;

const SETTINGS = 'tiempoMs=30000&tokensSalida=&temperaturaMilli=700&costeMaximoMicro=1000000';

function operationBody(key: string): string {
	return new URLSearchParams({
		clave: key,
		nombre: `Operación ${key}`,
		// El formulario no pide tokens de salida ni configuración de transcripción: solo `image` se puede dar de alta desde W40.
		tipo: 'image',
		modelo: '',
		grupo: 'C54',
		tiempoMs: '30000',
		costeMaximoMicro: '1000000',
		capacidades: JSON.stringify({ image_input: false, structured_output: false, tools: false }),
		confirmado: 'true'
	}).toString();
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_c54_operacion',
		email: 'admin.c54.operacion@ejemplo.es',
		password: 'contraseña-c54-operacion-123'
	});
	const app = await postAdmin(
		session,
		'/admin/apps?/crearApp',
		new URLSearchParams({
			slug: SLUG,
			nombre: 'Operaciones de C-54',
			descripcion: '',
			tiposCliente: JSON.stringify(['web']),
			enlaces: JSON.stringify({ landing: { type: 'internal' } }),
			esquemaSincronizacion: JSON.stringify({ categories: { notas: { strategy: 'block' } } }),
			origenes: '[]',
			soporte: '',
			confirmado: 'true'
		}).toString()
	);
	expect(app.status).toBe(303);
	for (const key of [TEMPLATE_KEY, ACTIVE_KEY]) {
		const created = await postAdmin(
			session,
			`/admin/apps/${SLUG}?/crearOperacion`,
			operationBody(key)
		);
		expect(created.status).toBe(303);
	}
	const db = new Database(databasePath);
	try {
		db.prepare("UPDATE app_operations SET mode = 'plantilla' WHERE key = ?").run(TEMPLATE_KEY);
		db.prepare("UPDATE app_operations SET active = 1, model = 'modelo-c54' WHERE key = ?").run(
			ACTIVE_KEY
		);
	} finally {
		db.close();
	}
});

afterAll(() => {
	const db = new Database(databasePath);
	try {
		db.prepare("UPDATE apps SET status = 'disabled' WHERE slug = ?").run(SLUG);
	} finally {
		db.close();
	}
});

describe('C-54 · W41 enlaza cada cambio con su entrada de auditoría (UX-13)', () => {
	it('guardar los parámetros vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`/admin/apps/${SLUG}/operaciones/${TEMPLATE_KEY}?/guardarOperacion`,
			`${SETTINGS}&motivo=Par%C3%A1metros+revisados&confirmado=true`
		);

		await expectAuditLink(session, databasePath, result, 'apps.operation.settings');
	});

	it('aplicar los parámetros al grupo vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`/admin/apps/${SLUG}/operaciones/${TEMPLATE_KEY}?/aplicarAlGrupo`,
			`${SETTINGS}&motivo=Grupo+revisado&confirmado=true`
		);

		await expectAuditLink(session, databasePath, result, 'apps.operation.settings');
	});

	it('publicar una versión de la plantilla vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const template = JSON.stringify({
			messages: [
				{ role: 'system', content: 'Eres un corrector.' },
				{ role: 'user', content: [{ type: 'text', text: '{{texto}}' }] }
			],
			variables: [{ name: 'texto', type: 'text', required: true, max_chars: 2000 }]
		});

		const result = await postAdmin(
			session,
			`/admin/apps/${SLUG}/operaciones/${TEMPLATE_KEY}?/guardarPlantilla`,
			`plantilla=${encodeURIComponent(template)}&confirmado=true`
		);

		await expectAuditLink(session, databasePath, result, 'apps.template.version');
	});

	it('desactivar vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`/admin/apps/${SLUG}/operaciones/${ACTIVE_KEY}?/desactivar`,
			'motivo=Retirada+de+prueba&confirmado=true'
		);

		await expectAuditLink(session, databasePath, result, 'apps.operation.deactivate');
	});
});
