// Administración de usuarios (BE-FR-50, BE-FR-04 CA4, BE-FR-18; W34–W35; T305–T306). Cada acción va en una transacción con su
// entrada de auditoría: si la acción no se escribe, tampoco la entrada, y al revés. El motivo es obligatorio en el bloqueo.
// La auditoría solo guarda ids y el estado anterior y nuevo, nunca datos personales.
import { and, count, desc, eq, like, or } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { session, user } from './schema';

export interface AdminUsersDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly audit: AuditDeps;
}

export const ADMIN_USERS_PAGE_SIZE = 25;
const TESTER_ROLE = 'tester';

export interface UserRow {
	readonly id: string;
	readonly email: string;
	readonly role: string;
	readonly banned: boolean;
	readonly deleted: boolean;
}

export interface UserSearchPage {
	readonly rows: readonly UserRow[];
	readonly pagination: {
		readonly page: number;
		readonly hasPrevious: boolean;
		readonly hasNext: boolean;
	};
}

/** Escapa los comodines de LIKE para que la búsqueda sea un texto literal. */
function likeLiteral(text: string): string {
	return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Búsqueda por email o id, paginada. Una cuenta borrada aparece como tal, sin su email original. */
export function searchUsers(
	deps: Pick<AdminUsersDeps, 'db'>,
	query: string,
	page: number
): UserSearchPage {
	const text = query.trim().toLowerCase();
	const where =
		text === ''
			? undefined
			: or(like(user.email, likeLiteral(text)), like(user.id, likeLiteral(text)));
	const found = deps.db
		.select({
			id: user.id,
			email: user.email,
			role: user.role,
			banned: user.banned,
			deletedAt: user.deletedAt
		})
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt), desc(user.id))
		.limit(ADMIN_USERS_PAGE_SIZE + 1)
		.offset((page - 1) * ADMIN_USERS_PAGE_SIZE)
		.all();
	return {
		rows: found.slice(0, ADMIN_USERS_PAGE_SIZE).map((row) => ({
			id: row.id,
			email: row.deletedAt === null ? row.email : 'cuenta borrada',
			role: row.role,
			banned: row.banned,
			deleted: row.deletedAt !== null
		})),
		pagination: {
			page,
			hasPrevious: page > 1,
			hasNext: found.length > ADMIN_USERS_PAGE_SIZE
		}
	};
}

export function userCount(deps: Pick<AdminUsersDeps, 'db'>): number {
	return deps.db.select({ total: count() }).from(user).get()?.total ?? 0;
}

function loadUser(tx: Tx, userId: string) {
	const row = tx.select().from(user).where(eq(user.id, userId)).get();
	if (row === undefined) throw new AppError('NOT_FOUND');
	if (row.deletedAt !== null) throw new AppError('NOT_FOUND', { reason: 'deleted' });
	return row;
}

function requireReason(reason: string): string {
	const trimmed = reason.trim();
	if (trimmed === '' || trimmed.length > 500) {
		throw new AppError('VALIDATION_ERROR', { field: 'reason' });
	}
	return trimmed;
}

interface AuditInput {
	readonly adminId: string;
	readonly action: string;
	readonly userId: string;
	readonly before: Record<string, unknown>;
	readonly after: Record<string, unknown>;
	readonly reason: string | null;
}

function audit(tx: Tx, deps: AdminUsersDeps, input: AuditInput): string {
	return recordEntry(
		tx,
		{
			adminId: input.adminId,
			action: input.action,
			entity: 'user',
			entityId: input.userId,
			before: input.before,
			after: input.after,
			reason: input.reason
		},
		deps.audit
	);
}

/**
 * Bloquea una cuenta con motivo y revoca todas sus sesiones (BE-FR-50). Si ya está bloqueada, `ALREADY_BLOCKED` y nada cambia.
 * Devuelve el id de la entrada de auditoría.
 */
export function blockUser(
	deps: AdminUsersDeps,
	input: { adminId: string; userId: string; reason: string }
): string {
	const reason = requireReason(input.reason);
	return immediateTransaction(deps.db, (tx) => {
		const current = loadUser(tx, input.userId);
		if (current.banned) throw new AppError('ALREADY_BLOCKED');
		tx.update(user)
			.set({ banned: true, banReason: reason, updatedAt: new Date(deps.clock.now()) })
			.where(eq(user.id, input.userId))
			.run();
		const closed = tx.delete(session).where(eq(session.userId, input.userId)).run().changes;
		const id = audit(tx, deps, {
			adminId: input.adminId,
			action: 'accounts.user.block',
			userId: input.userId,
			before: { banned: false },
			after: { banned: true, sessionsClosed: closed },
			reason
		});
		deps.logger.emit('accounts.user.blocked', { reason: 'admin' });
		deps.logger.emit('accounts.session.revoked', { reason: 'blocked', count: closed });
		return id;
	});
}

/** Desbloquea una cuenta. Si no está bloqueada, no hay nada que hacer: devuelve `null` sin cambios ni auditoría. */
export function unblockUser(
	deps: AdminUsersDeps,
	input: { adminId: string; userId: string; reason: string }
): string | null {
	const reason = requireReason(input.reason);
	return immediateTransaction(deps.db, (tx) => {
		const current = loadUser(tx, input.userId);
		if (!current.banned) return null;
		tx.update(user)
			.set({ banned: false, banReason: null, updatedAt: new Date(deps.clock.now()) })
			.where(eq(user.id, input.userId))
			.run();
		const id = audit(tx, deps, {
			adminId: input.adminId,
			action: 'accounts.user.unblock',
			userId: input.userId,
			before: { banned: true },
			after: { banned: false },
			reason
		});
		deps.logger.emit('accounts.user.unblocked', {});
		return id;
	});
}

/** Marca o desmarca el rol `tester`. Otros roles (`admin`) no se tocan aquí. Devuelve `null` si ya estaba así. */
export function setTester(
	deps: AdminUsersDeps,
	input: { adminId: string; userId: string; on: boolean; reason: string | null }
): string | null {
	return immediateTransaction(deps.db, (tx) => {
		const current = loadUser(tx, input.userId);
		const roles = current.role.split(',').filter((role) => role !== '');
		const has = roles.includes(TESTER_ROLE);
		if (has === input.on) return null;
		const next = input.on ? [...roles, TESTER_ROLE] : roles.filter((role) => role !== TESTER_ROLE);
		tx.update(user)
			.set({
				role: next.length > 0 ? next.join(',') : 'user',
				updatedAt: new Date(deps.clock.now())
			})
			.where(eq(user.id, input.userId))
			.run();
		const id = audit(tx, deps, {
			adminId: input.adminId,
			action: 'accounts.role.change',
			userId: input.userId,
			before: { tester: has },
			after: { tester: input.on },
			reason: input.reason
		});
		deps.logger.emit('accounts.role.changed', { status: input.on ? 'tester_on' : 'tester_off' });
		return id;
	});
}

/** Cierra una sesión concreta de la cuenta, o todas si `sessionId` es nulo. Devuelve cuántas se cerraron. */
export function closeUserSessions(
	deps: AdminUsersDeps,
	input: { adminId: string; userId: string; sessionId: string | null; reason: string }
): number {
	const reason = requireReason(input.reason);
	return immediateTransaction(deps.db, (tx) => {
		loadUser(tx, input.userId);
		// La sesión concreta también debe ser de esta cuenta: un id ajeno no cierra nada.
		const where =
			input.sessionId === null
				? eq(session.userId, input.userId)
				: and(eq(session.userId, input.userId), eq(session.id, input.sessionId));
		const closed = tx.delete(session).where(where).run().changes;
		audit(tx, deps, {
			adminId: input.adminId,
			action: 'accounts.session.close',
			userId: input.userId,
			before: { sessions: closed },
			after: { sessions: 0 },
			reason
		});
		deps.logger.emit('accounts.session.revoked', { reason: 'admin_closed', count: closed });
		return closed;
	});
}

export interface AccountView {
	readonly id: string;
	readonly email: string;
	readonly role: string;
	readonly banned: boolean;
	readonly banReason: string | null;
	readonly deleted: boolean;
}

/** Datos de una cuenta para su ficha de administración. Nulo si no existe. Una cuenta borrada no muestra su email. */
export function accountView(deps: Pick<AdminUsersDeps, 'db'>, userId: string): AccountView | null {
	const row = deps.db.select().from(user).where(eq(user.id, userId)).get();
	if (row === undefined) return null;
	return {
		id: row.id,
		email: row.deletedAt === null ? row.email : 'cuenta borrada',
		role: row.role,
		banned: row.banned,
		banReason: row.banReason,
		deleted: row.deletedAt !== null
	};
}
