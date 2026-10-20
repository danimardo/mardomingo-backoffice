// Matriz de acciones de administración (BE-FR-55, UX-13, SC-010; T321). Dos partes. (1) Quién puede entrar: cualquier ruta de
// administración solo deja pasar a un administrador verificado y no bloqueado; un usuario, un tester o una cuenta sin verificar
// reciben denegación. (2) Motivo obligatorio: las acciones que lo piden lo rechazan vacío, y ninguna escribe nada si falla, porque
// la validación va antes de cualquier cambio. Las acciones de W35–W44, W48 y W49 se prueban aquí a nivel de servicio; las páginas
// y sus acciones se comprueban con las pruebas HTTP y los E2E.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { accessFor, type SessionUser } from '$lib/server/features/accounts';
import {
	blockUser,
	closeUserSessions,
	setTester,
	unblockUser,
	type AdminUsersDeps
} from '$lib/server/features/accounts/admin-users';
import { session, user } from '$lib/server/features/accounts/schema';
import { createAnnouncement, type AnnouncementsAdminDeps } from '$lib/server/features/apps';
import { announcements } from '$lib/server/features/apps/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';

let f: CreditsFixture;
let adminDeps: AdminUsersDeps;
let annDeps: AnnouncementsAdminDeps;
let adminId: string;
let targetId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 8, 0, 0));
	const audit = { clock: f.clock, ids: createIdGenerator(), logger: f.logger };
	adminDeps = { db: f.db, logger: f.logger, clock: f.clock, ids: f.deps.ids, audit };
	annDeps = { db: f.db, logger: f.logger, clock: f.clock, ids: f.deps.ids, audit };
	adminId = f.addUser('usr_matriz_admin', 'admin');
	targetId = f.addUser('usr_matriz_objetivo');
	f.db
		.insert(session)
		.values({
			id: 'ses_m',
			userId: targetId,
			token: 'tok_m',
			expiresAt: new Date(f.clock.now() + 86_400_000)
		})
		.run();
});

afterEach(() => {
	f.close();
});

function who(role: string, overrides: Partial<SessionUser> = {}): SessionUser | null {
	if (role === 'anonimo') return null;
	return {
		id: 'usr_x',
		email: 'x@ejemplo.es',
		emailVerified: true,
		banned: false,
		role,
		...overrides
	};
}

function countSessions(): number {
	return f.db.select().from(session).where(eq(session.userId, targetId)).all().length;
}

describe('quién entra a la administración (BE-FR-10, T321)', () => {
	it('solo un administrador verificado y no bloqueado obtiene acceso', () => {
		expect(accessFor(who('admin'), 'admin').kind).toBe('allow');
		expect(accessFor(who('user'), 'admin').kind).toBe('not_admin');
		expect(accessFor(who('user,tester'), 'admin').kind).toBe('not_admin');
		expect(accessFor(who('admin', { emailVerified: false }), 'admin').kind).toBe('unverified');
		expect(accessFor(who('admin', { banned: true }), 'admin').kind).toBe('blocked');
		expect(accessFor(who('anonimo'), 'admin').kind).toBe('anonymous');
	});
});

describe('motivo obligatorio y sin cambios si falla (BE-FR-55)', () => {
	it('bloquear sin motivo no bloquea ni cierra sesiones', () => {
		expect(() => blockUser(adminDeps, { adminId, userId: targetId, reason: '' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.banned).toBe(false);
		expect(countSessions()).toBe(1);
	});

	it('desbloquear sin motivo no toca la cuenta', () => {
		blockUser(adminDeps, { adminId, userId: targetId, reason: 'revisión' });
		expect(() => unblockUser(adminDeps, { adminId, userId: targetId, reason: '   ' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
		expect(f.db.select().from(user).where(eq(user.id, targetId)).get()?.banned).toBe(true);
	});

	it('cerrar sesiones sin motivo no cierra ninguna', () => {
		expect(() =>
			closeUserSessions(adminDeps, { adminId, userId: targetId, sessionId: null, reason: '' })
		).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
		expect(countSessions()).toBe(1);
	});

	it('una cuenta inexistente no cambia nada y responde NOT_FOUND', () => {
		expect(() =>
			setTester(adminDeps, {
				adminId,
				userId: 'usr_no_existe',
				on: true,
				reason: 'Motivo de prueba'
			})
		).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
	});

	it('crear un anuncio con una ventana inválida no escribe nada', () => {
		const now = toEpochMs(f.clock.now());
		expect(() =>
			createAnnouncement(annDeps, {
				adminId,
				announcement: {
					appId: null,
					level: 'info',
					message: 'hola',
					link: null,
					startsAt: now,
					endsAt: now,
					minVersion: null,
					maxVersion: null
				}
			})
		).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
		expect(f.db.select().from(announcements).all()).toEqual([]);
	});
});
