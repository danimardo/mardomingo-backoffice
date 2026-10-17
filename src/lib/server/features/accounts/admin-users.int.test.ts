// Administración de usuarios contra SQLite real (BE-FR-50, BE-FR-04 CA4, BE-FR-18; T305): búsqueda paginada, bloqueo con motivo
// que revoca las sesiones, `ALREADY_BLOCKED`, desbloqueo, marcar y desmarcar `tester`, cierre de sesiones, motivo obligatorio, y
// una entrada de auditoría con antes y después por cada acción. Las cuentas borradas aparecen como tales.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { adminAudit } from '../audit/schema';
import { session, user } from './schema';
import {
	blockUser,
	closeUserSessions,
	searchUsers,
	setTester,
	unblockUser,
	type AdminUsersDeps
} from './admin-users';

let f: CreditsFixture;
let deps: AdminUsersDeps;
let adminId: string;
let targetId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 8, 0, 0));
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		ids: f.deps.ids,
		audit: { clock: f.clock, ids: f.deps.ids, logger: f.logger }
	};
	adminId = f.addUser('usr_admin_panel', 'admin');
	targetId = f.addUser('usr_objetivo');
	f.db.update(user).set({ email: 'ana.perez@ejemplo.es' }).where(eq(user.id, targetId)).run();
	for (const id of ['ses_1', 'ses_2']) {
		f.db
			.insert(session)
			.values({
				id,
				userId: targetId,
				token: `tok_${id}`,
				expiresAt: new Date(f.clock.now() + 86_400_000)
			})
			.run();
	}
});

afterEach(() => {
	f.close();
});

function sessionsOf(id: string): number {
	return f.db.select().from(session).where(eq(session.userId, id)).all().length;
}

function auditRows() {
	return f.db.select().from(adminAudit).all();
}

describe('búsqueda de usuarios (BE-FR-50)', () => {
	it('encuentra por parte del email y no por coincidencias ajenas', () => {
		const page = searchUsers(deps, 'perez', 1);

		expect(page.rows.map((row) => row.id)).toEqual([targetId]);
	});

	it('una cuenta borrada aparece como tal y sin su email', () => {
		f.db
			.update(user)
			.set({
				deletedAt: f.clock.now(),
				email: 'deleted+usr_objetivo@invalid',
				emailNormalized: null
			})
			.where(eq(user.id, targetId))
			.run();

		const page = searchUsers(deps, 'objetivo', 1);

		expect(page.rows[0]).toMatchObject({ email: 'cuenta borrada', deleted: true });
	});

	it('el texto de búsqueda con comodines es literal', () => {
		expect(searchUsers(deps, '%', 1).rows).toEqual([]);
	});
});

describe('bloqueo y desbloqueo (BE-FR-50)', () => {
	it('bloquea con motivo, revoca las sesiones y deja auditoría con antes y después', () => {
		expect(sessionsOf(targetId)).toBe(2);

		blockUser(deps, { adminId, userId: targetId, reason: 'fraude en pagos' });

		const row = f.db.select().from(user).where(eq(user.id, targetId)).get();
		expect(row).toMatchObject({ banned: true, banReason: 'fraude en pagos' });
		expect(sessionsOf(targetId)).toBe(0);
		expect(auditRows()).toEqual([
			expect.objectContaining({
				adminId,
				action: 'accounts.user.block',
				entity: 'user',
				entityId: targetId,
				reason: 'fraude en pagos',
				before: { banned: false },
				after: { banned: true, sessionsClosed: 2 }
			})
		]);
		expect(eventsNamed(f.logger, 'accounts.user.blocked')[0]?.fields).toEqual({ reason: 'admin' });
	});

	it('bloquear otra vez responde ALREADY_BLOCKED y no escribe nada', () => {
		blockUser(deps, { adminId, userId: targetId, reason: 'primero' });

		expect(() => blockUser(deps, { adminId, userId: targetId, reason: 'segundo' })).toThrow(
			expect.objectContaining({ code: 'ALREADY_BLOCKED' })
		);
		expect(auditRows()).toHaveLength(1);
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.banReason).toBe('primero');
	});

	it('sin motivo no bloquea (VALIDATION_ERROR) y tampoco con solo espacios', () => {
		expect(() => blockUser(deps, { adminId, userId: targetId, reason: '   ' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.banned).toBe(false);
		expect(auditRows()).toEqual([]);
	});

	it('desbloquea con motivo y deja auditoría; desbloquear una cuenta libre no hace nada', () => {
		blockUser(deps, { adminId, userId: targetId, reason: 'revisión' });

		expect(
			unblockUser(deps, { adminId, userId: targetId, reason: 'revisado, era un error' })
		).not.toBeNull();
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()).toMatchObject({
			banned: false,
			banReason: null
		});
		expect(unblockUser(deps, { adminId, userId: targetId, reason: 'otra vez' })).toBeNull();
		expect(auditRows().map((row) => row.action)).toEqual([
			'accounts.user.block',
			'accounts.user.unblock'
		]);
	});

	it('una cuenta borrada no se bloquea: NOT_FOUND', () => {
		f.db.update(user).set({ deletedAt: f.clock.now() }).where(eq(user.id, targetId)).run();

		expect(() => blockUser(deps, { adminId, userId: targetId, reason: 'x' })).toThrow(
			expect.objectContaining({ code: 'NOT_FOUND' })
		);
	});
});

describe('rol tester (BE-FR-18)', () => {
	it('marca y desmarca tester con auditoría anterior → nuevo, sin tocar otros roles', () => {
		f.db.update(user).set({ role: 'user,editor' }).where(eq(user.id, targetId)).run();

		setTester(deps, { adminId, userId: targetId, on: true, reason: null });
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.role).toBe(
			'user,editor,tester'
		);

		setTester(deps, { adminId, userId: targetId, on: false, reason: null });
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.role).toBe('user,editor');
		expect(auditRows().map((row) => row.before)).toEqual([{ tester: false }, { tester: true }]);
		expect(eventsNamed(f.logger, 'accounts.role.changed').map((event) => event.fields)).toEqual([
			{ status: 'tester_on' },
			{ status: 'tester_off' }
		]);
	});

	it('marcar lo que ya estaba marcado no escribe ni audita', () => {
		setTester(deps, { adminId, userId: targetId, on: true, reason: null });

		expect(setTester(deps, { adminId, userId: targetId, on: true, reason: null })).toBeNull();
		expect(auditRows()).toHaveLength(1);
	});
});

describe('cierre de sesiones (BE-FR-50)', () => {
	it('cierra una sesión concreta de la cuenta y deja auditoría', () => {
		const closed = closeUserSessions(deps, {
			adminId,
			userId: targetId,
			sessionId: 'ses_1',
			reason: 'dispositivo perdido'
		});

		expect(closed).toBe(1);
		expect(sessionsOf(targetId)).toBe(1);
		expect(auditRows()[0]).toMatchObject({
			action: 'accounts.session.close',
			reason: 'dispositivo perdido'
		});
	});

	it('no cierra una sesión de otra cuenta aunque se conozca su id', () => {
		const otherId = f.addUser('usr_otro');
		f.db
			.insert(session)
			.values({
				id: 'ses_ajena',
				userId: otherId,
				token: 'tok_ajena',
				expiresAt: new Date(f.clock.now() + 1000)
			})
			.run();

		const closed = closeUserSessions(deps, {
			adminId,
			userId: targetId,
			sessionId: 'ses_ajena',
			reason: 'prueba'
		});

		expect(closed).toBe(0);
		expect(sessionsOf(otherId)).toBe(1);
	});

	it('cierra todas las sesiones de la cuenta sin tocar las de otras', () => {
		const otherId = f.addUser('usr_otro_dos');
		f.db
			.insert(session)
			.values({
				id: 'ses_otra',
				userId: otherId,
				token: 'tok_otra',
				expiresAt: new Date(f.clock.now() + 1000)
			})
			.run();

		expect(
			closeUserSessions(deps, { adminId, userId: targetId, sessionId: null, reason: 'seguridad' })
		).toBe(2);
		expect(sessionsOf(otherId)).toBe(1);
	});
});
