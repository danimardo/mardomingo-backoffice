// Lectura de la auditoría contra SQLite real (BE-FR-55; W46–W47; T303): filtros por entidad, acción y día, paginación de 25,
// la entrada completa, y que no existe ninguna vía para editarla ni borrarla (los triggers lo impiden en la base de datos).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { immediateTransaction } from '$lib/server/db/tx';
import { toEpochMs } from '$lib/shared/time';
import { auditEntry, auditPage, AUDIT_PAGE_SIZE } from './index';
import { recordEntry } from './service';
import { adminAudit } from './schema';

let f: CreditsFixture;
let adminId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	adminId = f.addUser('usr_admin', 'admin');
});

afterEach(() => {
	f.close();
});

function write(
	entity: string,
	action: string,
	reason: string | null = null,
	entityId: string | null = 'x'
): string {
	return immediateTransaction(f.db, (tx) =>
		recordEntry(
			tx,
			{ adminId, action, entity, entityId, before: null, after: { ok: true }, reason },
			{
				clock: f.clock,
				ids: f.deps.ids,
				logger: f.logger
			}
		)
	);
}

describe('auditoría del panel (W46–W47)', () => {
	it('lista la más reciente primero y filtra por entidad y por acción', () => {
		write('user', 'accounts.user.blocked', 'fraude');
		f.clock.advance(1000);
		write('credit', 'credits.adjust', 'corrección');
		f.clock.advance(1000);
		write('user', 'accounts.role.changed');

		const all = auditPage(f.db, { entity: null, action: null, fromMs: null, toMs: null, page: 1 });
		expect(all.rows.map((row) => row.action)).toEqual([
			'accounts.role.changed',
			'credits.adjust',
			'accounts.user.blocked'
		]);
		expect(all.total).toBe(3);

		const users = auditPage(f.db, {
			entity: 'user',
			action: null,
			fromMs: null,
			toMs: null,
			page: 1
		});
		expect(users.rows).toHaveLength(2);
		const role = auditPage(f.db, {
			entity: null,
			action: 'accounts.role.changed',
			fromMs: null,
			toMs: null,
			page: 1
		});
		expect(role.rows).toHaveLength(1);
	});

	it('filtra por día: solo entran las entradas dentro del intervalo', () => {
		write('user', 'accounts.user.blocked');
		f.clock.advance(3 * 24 * 60 * 60 * 1000);
		write('user', 'accounts.user.unblocked');

		const after = auditPage(f.db, {
			entity: null,
			action: null,
			fromMs: toEpochMs(f.clock.now() - 60_000),
			toMs: null,
			page: 1
		});

		expect(after.rows.map((row) => row.action)).toEqual(['accounts.user.unblocked']);
	});

	it('pagina de 25 en 25 y dice si hay más páginas', () => {
		for (let index = 0; index < AUDIT_PAGE_SIZE + 3; index += 1)
			write('user', 'accounts.role.changed');

		const first = auditPage(f.db, {
			entity: null,
			action: null,
			fromMs: null,
			toMs: null,
			page: 1
		});
		const second = auditPage(f.db, {
			entity: null,
			action: null,
			fromMs: null,
			toMs: null,
			page: 2
		});

		expect(first.rows).toHaveLength(AUDIT_PAGE_SIZE);
		expect(first.pagination).toEqual({ page: 1, hasPrevious: false, hasNext: true });
		expect(second.rows).toHaveLength(3);
		expect(second.pagination).toEqual({ page: 2, hasPrevious: true, hasNext: false });
	});

	it('la entrada completa lleva su motivo y sus instantáneas; una inexistente no existe', () => {
		const id = write('credit', 'credits.adjust', 'corrección de prueba', 'usr_destino');

		const entry = auditEntry(f.db, id);

		expect(entry).toMatchObject({
			id,
			adminId,
			action: 'credits.adjust',
			entity: 'credit',
			entityId: 'usr_destino',
			reason: 'corrección de prueba',
			after: { ok: true }
		});
		expect(auditEntry(f.db, 'aud_inexistente')).toBeNull();
	});

	it('no hay vía para editar ni borrar: los triggers de la base de datos lo rechazan', () => {
		const id = write('user', 'accounts.role.changed');

		expect(() =>
			f.database.sqlite
				.prepare('UPDATE admin_audit SET reason = ? WHERE id = ?')
				.run('alterado', id)
		).toThrow(/append-only/);
		expect(() => f.database.sqlite.prepare('DELETE FROM admin_audit WHERE id = ?').run(id)).toThrow(
			/append-only/
		);
		expect(f.db.select().from(adminAudit).all()).toHaveLength(1);
	});
});
