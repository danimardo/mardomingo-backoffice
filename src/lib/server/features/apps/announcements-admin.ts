// Anuncios del administrador (BE-FR-85, CA1–CA2; W49; T315). La tabla y su CRUD son de `apps` (decisión del propietario). Cada cambio
// va en una transacción con su entrada de auditoría. Un anuncio es para una app o para todas (`appId` nulo). La ventana es
// [inicio, fin) con `fin > inicio`; el rango de versiones es opcional y el mínimo no puede superar al máximo.
import { desc, eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import type { EpochMs } from '$lib/shared/time';
import { ANNOUNCEMENT_LEVELS, announcements, apps } from './schema';

export interface AnnouncementsAdminDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly audit: AuditDeps;
}

export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number];

/** `true` si el texto es uno de los niveles aprobados. Estrecha el tipo sin aserciones. */
export function isAnnouncementLevel(value: string): value is AnnouncementLevel {
	return ANNOUNCEMENT_LEVELS.some((level) => level === value);
}

export interface AnnouncementInput {
	readonly appId: string | null;
	readonly level: string;
	readonly message: string;
	readonly link: string | null;
	readonly startsAt: EpochMs;
	readonly endsAt: EpochMs | null;
	readonly minVersion: string | null;
	readonly maxVersion: string | null;
}

export interface AnnouncementRow extends AnnouncementInput {
	readonly id: string;
	readonly active: boolean;
}

const MAX_MESSAGE = 500;
const MAX_LINK = 500;
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Valida un anuncio y devuelve sus datos normalizados. Lanza `VALIDATION_ERROR` con el campo. */
export function validatedAnnouncement(
	input: AnnouncementInput
): AnnouncementInput & { readonly level: AnnouncementLevel } {
	const fail = (field: string): never => {
		throw new AppError('VALIDATION_ERROR', { field });
	};
	const message = input.message.trim();
	if (message === '' || message.length > MAX_MESSAGE) fail('message');
	const level = input.level;
	if (!isAnnouncementLevel(level)) throw new AppError('VALIDATION_ERROR', { field: 'level' });
	const link = input.link === null || input.link.trim() === '' ? null : input.link.trim();
	if (link !== null && (link.length > MAX_LINK || !/^(https?:\/\/|\/)/.test(link))) fail('link');
	if (input.endsAt !== null && input.endsAt <= input.startsAt) fail('endsAt');
	for (const [field, value] of [
		['minVersion', input.minVersion],
		['maxVersion', input.maxVersion]
	] as const) {
		if (value !== null && !SEMVER.test(value)) fail(field);
	}
	if (
		input.minVersion !== null &&
		input.maxVersion !== null &&
		input.minVersion > input.maxVersion
	) {
		fail('maxVersion');
	}
	return { ...input, message, link, level };
}

function audit(
	tx: Tx,
	deps: AnnouncementsAdminDeps,
	input: {
		action: string;
		id: string;
		adminId: string;
		before: Record<string, unknown> | null;
		after: Record<string, unknown> | null;
	}
): string {
	return recordEntry(
		tx,
		{
			adminId: input.adminId,
			action: input.action,
			entity: 'announcement',
			entityId: input.id,
			before: input.before,
			after: input.after,
			reason: null
		},
		deps.audit
	);
}

/** Crea un anuncio. Devuelve su id y el de la entrada de auditoría. */
export function createAnnouncement(
	deps: AnnouncementsAdminDeps,
	input: { adminId: string; announcement: AnnouncementInput }
): { id: string; auditId: string } {
	const data = validatedAnnouncement(input.announcement);
	return immediateTransaction(deps.db, (tx) => {
		const id = deps.ids('ann');
		const now = deps.clock.now();
		tx.insert(announcements)
			.values({
				id,
				appId: data.appId,
				level: data.level,
				message: data.message,
				link: data.link,
				startsAt: data.startsAt,
				endsAt: data.endsAt,
				minVersion: data.minVersion,
				maxVersion: data.maxVersion,
				active: true,
				createdAt: now,
				updatedAt: now
			})
			.run();
		const auditId = audit(tx, deps, {
			action: 'apps.announcement.create',
			id,
			adminId: input.adminId,
			before: null,
			after: { level: data.level, appId: data.appId }
		});
		deps.logger.emit('apps.announcement.created', {});
		return { id, auditId };
	});
}

/** Desactiva un anuncio sin borrarlo (queda en el historial). Si ya estaba inactivo, no hace nada y devuelve `null`. */
export function deactivateAnnouncement(
	deps: AnnouncementsAdminDeps,
	input: { adminId: string; id: string }
): string | null {
	return immediateTransaction(deps.db, (tx) => {
		const current = tx.select().from(announcements).where(eq(announcements.id, input.id)).get();
		if (current === undefined) throw new AppError('NOT_FOUND');
		if (!current.active) return null;
		tx.update(announcements)
			.set({ active: false, updatedAt: deps.clock.now() })
			.where(eq(announcements.id, input.id))
			.run();
		deps.logger.emit('apps.announcement.deactivated', {});
		return audit(tx, deps, {
			action: 'apps.announcement.deactivate',
			id: input.id,
			adminId: input.adminId,
			before: { active: true },
			after: { active: false }
		});
	});
}

/** Todos los anuncios, del más reciente al más antiguo, para la lista de W49. */
export function listAnnouncements(deps: Pick<AnnouncementsAdminDeps, 'db'>): AnnouncementRow[] {
	return deps.db
		.select()
		.from(announcements)
		.orderBy(desc(announcements.createdAt), desc(announcements.id))
		.all()
		.map((row) => ({
			id: row.id,
			appId: row.appId,
			level: row.level,
			message: row.message,
			link: row.link,
			startsAt: row.startsAt,
			endsAt: row.endsAt,
			minVersion: row.minVersion,
			maxVersion: row.maxVersion,
			active: row.active
		}));
}

/** Apps para el selector de W49: id y nombre, por orden alfabético. Solo lectura. */
export function appOptionsForAnnouncements(
	deps: Pick<AnnouncementsAdminDeps, 'db'>
): { id: string; name: string }[] {
	return deps.db.select({ id: apps.id, name: apps.name }).from(apps).orderBy(apps.name).all();
}
