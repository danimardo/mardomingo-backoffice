// C-54 (T445; UX-13, BE-FR-55): las acciones auditadas de W44 (`/admin/protecciones`) vuelven con `?aviso=saved&auditoria=<id>` y la
// página enlaza con esa entrada. Los valores no cambian nada que usen otras pruebas: el límite se guarda con su valor vigente, la
// alerta de Mistral se deja sin error y el freno se activa a mano solo para liberarlo.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/protecciones';

let session: AdminSession;

function madridToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function setBrakeActive(): void {
	const db = new Database(databasePath);
	try {
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
	} finally {
		db.close();
	}
}

function settingValue(key: string): string {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
			.get(key);
		if (row === undefined) throw new Error(`falta el ajuste ${key}`);
		return String(JSON.parse(row.value));
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_c54_protecciones',
		email: 'admin.c54.protecciones@ejemplo.es',
		password: 'contraseña-c54-protecciones-123'
	});
});

afterAll(() => {
	const db = new Database(databasePath);
	try {
		db.prepare("DELETE FROM protection_state WHERE key = 'global_brake'").run();
	} finally {
		db.close();
	}
});

describe('C-54 · W44 enlaza cada cambio con su entrada de auditoría (UX-13)', () => {
	it('guardar un límite vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			clave: 'login_max_failures',
			valor: settingValue('login_max_failures'),
			motivo: 'Revisión de límites',
			confirmado: 'true'
		});

		const result = await postAdmin(session, `${PAGE}?/guardarLimites`, body.toString());

		await expectAuditLink(session, databasePath, result, 'apps.setting.update');
	});

	it('declarar la alerta de Mistral vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`${PAGE}?/fijarAlertaMistral`,
			'error=false&motivo=Facturaci%C3%B3n+al+d%C3%ADa&confirmado=true'
		);

		await expectAuditLink(session, databasePath, result, 'notifications.mistral_billing.set');
	});

	it('liberar el freno vuelve con ?aviso=saved&auditoria=<id> y la entrada guarda el motivo', async () => {
		setBrakeActive();

		const result = await postAdmin(
			session,
			`${PAGE}?/liberarFreno`,
			'motivo=Coste+revisado&confirmado=true'
		);

		const entryId = await expectAuditLink(
			session,
			databasePath,
			result,
			'protections.brake.released'
		);
		const db = new Database(databasePath, { readonly: true });
		try {
			const row = db
				.prepare<[string], { reason: string | null }>('SELECT reason FROM admin_audit WHERE id = ?')
				.get(entryId);
			expect(row?.reason).toBe('Coste revisado');
		} finally {
			db.close();
		}
	});
});
