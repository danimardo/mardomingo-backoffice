// C-55 (T446; BE-FR-55, cierra R08 y D09): el motivo es de 1 a 500 caracteres tras recortar en todas las acciones de administración
// que lo piden. Con 501 caracteres cada acción responde 400, no audita, y la página pinta «El motivo no puede tener más de 500
// caracteres.» junto al campo y conserva lo escrito. Fuera de la matriz: `reembolsar` (necesita una compra pagada que esta base no
// tiene; lo cubre `refund-chargeback.int.test.ts`) y las vistas previas, que no escriben.
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');

const LONG_REASON = 'm'.repeat(501);
const TOO_LONG_TEXT = 'El motivo no puede tener más de 500 caracteres.';
const TARGET = 'usr_c55_objetivo';
const BLOCKED_TARGET = 'usr_c55_bloqueado';
const ANNOUNCEMENT_MESSAGE = 'Anuncio de prueba de C-55';
const ADMIN_ID = 'usr_http_c55_admin';

/** Acción, campos propios y si la página vuelve a pintar el campo del motivo de ese formulario. */
interface Case {
	readonly path: string;
	/** Consulta de la página que pinta el formulario (p. ej. `vista=propia` en la copia de predeterminados). */
	readonly query?: string;
	readonly action: string;
	readonly fields?: Readonly<Record<string, string>>;
	/** `false` solo si el formulario no existe en ese estado (p. ej. activar una operación ya activa). */
	readonly rendersField?: boolean;
}

const CASES: readonly Case[] = [
	{ path: '/admin/apps/secretario', action: 'guardarApp' },
	{ path: '/admin/apps/secretario', action: 'guardarVersiones' },
	{
		path: '/admin/apps/secretario',
		action: 'guardarMantenimiento',
		fields: { activo: 'false', mensaje: '' }
	},
	{
		path: '/admin/apps/secretario',
		action: 'guardarSobrescrituras',
		fields: { sobrescrituras: '{}' }
	},
	// El arranque de los tests HTTP activa `improve` (`activateChatOperation`): el formulario de activar no se pinta.
	{ path: '/admin/apps/secretario/operaciones/improve', action: 'activar', rendersField: false },
	{ path: '/admin/apps/secretario/operaciones/improve', action: 'desactivar' },
	{ path: '/admin/apps/secretario/operaciones/improve', action: 'guardarOperacion' },
	{
		path: '/admin/apps/secretario/operaciones/improve',
		action: 'aplicarAlGrupo',
		fields: {
			tiempoMs: '45000',
			tokensSalida: '',
			temperaturaMilli: '700',
			costeMaximoMicro: '1000000'
		}
	},
	{
		path: '/admin/apps/secretario/predeterminados',
		action: 'guardarPredeterminados',
		fields: { datos: '{}' }
	},
	{
		path: '/admin/apps/secretario/predeterminados/copiar',
		query: 'vista=propia',
		action: 'copiar',
		fields: { usuario: ADMIN_ID, 'sel:preferences': 'language' }
	},
	{
		path: '/admin/economia',
		action: 'guardarParametros',
		fields: { clave: 'max_debt', valor: '0' }
	},
	{ path: '/admin/economia', action: 'fijarTipoCambioManual', fields: { usdEurPpm: '920000' } },
	{ path: '/admin/economia', action: 'quitarTipoCambioManual' },
	{
		path: '/admin/economia',
		action: 'guardarPrecioOrientativo',
		fields: { operacion: 'op_inexistente', microUsd: '5' }
	},
	{ path: '/admin/protecciones', action: 'fijarAlertaMistral', fields: { error: 'false' } },
	{
		path: '/admin/protecciones',
		action: 'guardarLimites',
		fields: { clave: 'login_max_failures', valor: '5' }
	},
	{ path: `/admin/usuarios/${TARGET}`, action: 'bloquear' },
	{ path: `/admin/usuarios/${BLOCKED_TARGET}`, action: 'desbloquear' },
	{ path: `/admin/usuarios/${TARGET}`, action: 'tester', fields: { on: 'true' } },
	{ path: `/admin/usuarios/${TARGET}`, action: 'cerrarSesiones' },
	{
		path: `/admin/usuarios/${TARGET}/ajuste`,
		action: 'ajustarSaldo',
		fields: { cantidad: '1', tipo: 'credit', bolsa: 'paid', vence: '', clave: randomUUID() }
	}
];

let session: AdminSession;
let announcementId: string;

function withDb<T>(run: (db: Database.Database) => T): T {
	const db = new Database(databasePath);
	try {
		return run(db);
	} finally {
		db.close();
	}
}

function auditTotal(): number {
	return withDb(
		(db) => db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit').get()?.n ?? 0
	);
}

function madridToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function bodyOf(fields: Readonly<Record<string, string>> = {}): string {
	return new URLSearchParams({ ...fields, motivo: LONG_REASON, confirmado: 'true' }).toString();
}

async function expectRejected(
	path: string,
	action: string,
	fields: Readonly<Record<string, string>> | undefined,
	rendersField: boolean,
	query?: string
): Promise<void> {
	const before = auditTotal();

	const target = query === undefined ? `${path}?/${action}` : `${path}?${query}&/${action}`;
	const result = await postAdmin(session, target, bodyOf(fields));

	expect(result.status).toBe(400);
	expect(auditTotal()).toBe(before);
	if (rendersField) {
		expect(result.text).toContain(TOO_LONG_TEXT);
		expect(result.text).toContain(`value="${LONG_REASON}"`);
	}
}

beforeAll(async () => {
	withDb((db) => {
		const now = Date.now();
		const insert = db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', ?, ?, ?, ?)`
		);
		insert.run(TARGET, 'objetivo.c55@ejemplo.es', 0, 'objetivo.c55@ejemplo.es', now, now);
		insert.run(BLOCKED_TARGET, 'bloqueado.c55@ejemplo.es', 1, 'bloqueado.c55@ejemplo.es', now, now);
	});
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: ADMIN_ID,
		email: 'admin.c55@ejemplo.es',
		password: 'contraseña-c55-motivo-123'
	});
	const created = await postAdmin(
		session,
		'/admin/anuncios?/crear',
		new URLSearchParams({
			appId: '',
			nivel: 'info',
			mensaje: ANNOUNCEMENT_MESSAGE,
			enlace: '',
			inicio: '2099-01-01T00:00',
			fin: '',
			minVersion: '',
			maxVersion: ''
		}).toString()
	);
	expect(created.status).toBe(303);
	// Datos propios que la copia de predeterminados lista con `vista=propia` (el formulario solo se pinta con categorías).
	withDb((db) => {
		const now = Date.now();
		db.prepare(
			`INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at)
			 SELECT ?, id, 1, ?, ?, ? FROM apps WHERE slug = 'secretario'`
		).run(
			ADMIN_ID,
			JSON.stringify({ preferences: { language: { value: 'es', updatedAt: 1 } } }),
			now,
			now
		);
	});
	announcementId = withDb(
		(db) =>
			db
				.prepare<[string], { id: string }>('SELECT id FROM announcements WHERE message = ?')
				.get(ANNOUNCEMENT_MESSAGE)?.id ?? ''
	);
});

afterAll(() => {
	withDb((db) => {
		db.prepare('UPDATE announcements SET active = 0 WHERE message = ?').run(ANNOUNCEMENT_MESSAGE);
		db.prepare("DELETE FROM protection_state WHERE key = 'global_brake'").run();
		db.prepare('DELETE FROM sync_documents WHERE user_id = ?').run(ADMIN_ID);
	});
});

describe('C-55 · un motivo de más de 500 caracteres se rechaza junto al campo y conserva lo escrito', () => {
	it.each(CASES)('$path?/$action', async ({ path, query, action, fields, rendersField = true }) => {
		await expectRejected(path, action, fields, rendersField, query);
	});

	it('/admin/anuncios?/desactivar', async () => {
		await expectRejected('/admin/anuncios', 'desactivar', { anuncioId: announcementId }, true);
	});

	it('/admin/protecciones?/liberarFreno', async () => {
		withDb((db) => {
			const now = Date.now();
			const value = JSON.stringify({
				day: madridToday(),
				active: true,
				activatedAt: now,
				releasedAt: null,
				releasedBy: null
			});
			db.prepare(
				"INSERT INTO protection_state (key, value, updated_at) VALUES ('global_brake', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
			).run(value, now);
		});

		await expectRejected('/admin/protecciones', 'liberarFreno', undefined, true);
	});

	it('un motivo de 500 caracteres tras recortar sí vale', async () => {
		const before = auditTotal();
		const body = new URLSearchParams({
			error: 'false',
			motivo: `  ${'m'.repeat(500)}  `,
			confirmado: 'true'
		}).toString();

		const result = await postAdmin(session, '/admin/protecciones?/fijarAlertaMistral', body);

		expect(result.status).toBe(303);
		expect(auditTotal()).toBe(before + 1);
	});
});
