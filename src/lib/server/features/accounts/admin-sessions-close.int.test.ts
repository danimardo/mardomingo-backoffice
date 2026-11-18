// A-04 · Cerrar una sesión que no existe o que es de otra cuenta no responde 404 y deja una entrada de auditoría vacía
// (contracts/web-routes.md W35: `?/cerrarSesiones` → errores `404`; BE-FR-55: la auditoría registra cambios reales).
// `closeUserSessions` (accounts/admin-users.ts:224-247) filtra por cuenta y sesión, borra 0 filas y aun así escribe
// `accounts.session.close` con `before: { sessions: 0 }`; la acción redirige como si hubiera cerrado algo.
//
// Destino en el repo: copiar el `describe` dentro de src/routes/(web)/admin/admin-actions.int.test.ts (usa su fixture y sus
// dependencias: `f`, `adminDeps`, `adminId`, `targetId`, `countSessions`), o dejarlo como fichero propio en
// src/lib/server/features/accounts/admin-sessions-close.int.test.ts con este montaje.
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/accounts/admin-sessions-close.int.test.ts
// Debe FALLAR hoy: `closeUserSessions` devuelve 0 en lugar de lanzar NOT_FOUND, y queda una entrada de auditoría.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { adminAudit } from '$lib/server/features/audit/schema';
import { closeUserSessions, type AdminUsersDeps } from './admin-users';
import { session } from './schema';
import { createIdGenerator } from '$lib/server/shared/ids';

let f: CreditsFixture;
let deps: AdminUsersDeps;
let adminId: string;
let targetId: string;
let otherId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 8, 0, 0));
	const audit = { clock: f.clock, ids: createIdGenerator(), logger: f.logger };
	deps = { db: f.db, logger: f.logger, clock: f.clock, ids: f.deps.ids, audit };
	adminId = f.addUser('usr_a04_admin', 'admin');
	targetId = f.addUser('usr_a04_objetivo');
	otherId = f.addUser('usr_a04_otra');
	f.db
		.insert(session)
		.values([
			{
				id: 'ses_a04_objetivo',
				userId: targetId,
				token: 'tok_a04_objetivo',
				expiresAt: new Date(f.clock.now() + 86_400_000)
			},
			{
				id: 'ses_a04_otra',
				userId: otherId,
				token: 'tok_a04_otra',
				expiresAt: new Date(f.clock.now() + 86_400_000)
			}
		])
		.run();
});

afterEach(() => {
	f.close();
});

function closeAudits() {
	return f.db
		.select()
		.from(adminAudit)
		.where(eq(adminAudit.action, 'accounts.session.close'))
		.all();
}

describe('A-04 · cerrar una sesión que no es de la cuenta (W35: 404)', () => {
	it('una sesión inexistente responde NOT_FOUND y no audita', () => {
		expect(() =>
			closeUserSessions(deps, {
				adminId,
				userId: targetId,
				sessionId: 'ses_no_existe',
				reason: 'Sesión sospechosa'
			})
		).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
		expect(closeAudits()).toEqual([]);
	});

	it('la sesión de otra cuenta responde NOT_FOUND, no la cierra y no audita', () => {
		expect(() =>
			closeUserSessions(deps, {
				adminId,
				userId: targetId,
				sessionId: 'ses_a04_otra',
				reason: 'Sesión sospechosa'
			})
		).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
		expect(f.db.select().from(session).where(eq(session.id, 'ses_a04_otra')).get()).toBeDefined();
		expect(closeAudits()).toEqual([]);
	});

	it('control: la sesión propia se cierra y se audita una vez', () => {
		expect(
			closeUserSessions(deps, {
				adminId,
				userId: targetId,
				sessionId: 'ses_a04_objetivo',
				reason: 'Sesión sospechosa'
			})
		).toBe(1);
		expect(closeAudits()).toHaveLength(1);
	});
});
