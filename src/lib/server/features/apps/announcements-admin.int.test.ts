// Anuncios del administrador contra SQLite real (BE-FR-85 CA1–CA2; T315): creación para una app o para todas, validación de la
// ventana, el nivel, el enlace y las versiones, auditoría por cada cambio, desactivar sin borrar y la lista.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '../audit/schema';
import { toEpochMs } from '$lib/shared/time';
import {
	createAnnouncement,
	deactivateAnnouncement,
	listAnnouncements,
	type AnnouncementInput,
	type AnnouncementsAdminDeps
} from './index';
import { announcements } from './schema';

let f: CreditsFixture;
let deps: AnnouncementsAdminDeps;
let adminId: string;
const START = toEpochMs(Date.UTC(2026, 9, 17, 8, 0, 0));
const END = toEpochMs(Date.UTC(2026, 9, 18, 8, 0, 0));

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 7, 0, 0));
	deps = {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		ids: f.deps.ids,
		audit: { clock: f.clock, ids: f.deps.ids, logger: f.logger }
	};
	adminId = f.addUser('usr_admin_anuncios', 'admin');
});

afterEach(() => {
	f.close();
});

function announcement(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
	return {
		appId: SEEDED_APP_ID,
		level: 'info',
		message: 'Mantenimiento el sábado por la mañana.',
		link: null,
		startsAt: START,
		endsAt: END,
		minVersion: null,
		maxVersion: null,
		...overrides
	};
}

function codeOf(run: () => unknown): string | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return error instanceof Error && 'code' in error ? String(error.code) : undefined;
	}
}

describe('anuncios del administrador (BE-FR-85)', () => {
	it('crea un anuncio para una app o para todas, y deja auditoría', () => {
		const one = createAnnouncement(deps, { adminId, announcement: announcement() });
		const all = createAnnouncement(deps, {
			adminId,
			announcement: announcement({ appId: null, level: 'warning' })
		});

		expect(
			listAnnouncements(deps)
				.map((row) => row.appId)
				.sort()
		).toEqual([null, SEEDED_APP_ID].sort());
		expect(f.db.select().from(announcements).all()).toHaveLength(2);
		expect(
			f.db
				.select()
				.from(adminAudit)
				.all()
				.map((row) => row.entityId)
				.sort()
		).toEqual([one.id, all.id].sort());
		expect(eventsNamed(f.logger, 'apps.announcement.created')).toHaveLength(2);
	});

	it('el mensaje se recorta y no puede quedar vacío', () => {
		expect(
			codeOf(() =>
				createAnnouncement(deps, { adminId, announcement: announcement({ message: '   ' }) })
			)
		).toBe('VALIDATION_ERROR');
		createAnnouncement(deps, { adminId, announcement: announcement({ message: '  hola  ' }) });
		expect(listAnnouncements(deps)[0]?.message).toBe('hola');
	});

	it('la ventana exige fin posterior al inicio; sin fin, el anuncio no caduca', () => {
		expect(
			codeOf(() =>
				createAnnouncement(deps, { adminId, announcement: announcement({ endsAt: START }) })
			)
		).toBe('VALIDATION_ERROR');
		expect(
			codeOf(() =>
				createAnnouncement(deps, {
					adminId,
					announcement: announcement({ endsAt: toEpochMs(START - 1) })
				})
			)
		).toBe('VALIDATION_ERROR');
		expect(() =>
			createAnnouncement(deps, { adminId, announcement: announcement({ endsAt: null }) })
		).not.toThrow();
	});

	it('el nivel es uno de los aprobados y el enlace es una ruta o una URL http(s)', () => {
		expect(
			codeOf(() =>
				createAnnouncement(deps, { adminId, announcement: announcement({ level: 'urgente' }) })
			)
		).toBe('VALIDATION_ERROR');
		expect(
			codeOf(() =>
				createAnnouncement(deps, {
					adminId,
					announcement: announcement({ link: 'javascript:alert(1)' })
				})
			)
		).toBe('VALIDATION_ERROR');
		expect(() =>
			createAnnouncement(deps, { adminId, announcement: announcement({ link: '/panel' }) })
		).not.toThrow();
		expect(() =>
			createAnnouncement(deps, {
				adminId,
				announcement: announcement({ link: 'https://ejemplo.es/notas' })
			})
		).not.toThrow();
	});

	it('las versiones son semver y el mínimo no supera al máximo', () => {
		expect(
			codeOf(() =>
				createAnnouncement(deps, { adminId, announcement: announcement({ minVersion: '4.0' }) })
			)
		).toBe('VALIDATION_ERROR');
		expect(
			codeOf(() =>
				createAnnouncement(deps, {
					adminId,
					announcement: announcement({ minVersion: '4.2.0', maxVersion: '4.1.0' })
				})
			)
		).toBe('VALIDATION_ERROR');
		expect(() =>
			createAnnouncement(deps, {
				adminId,
				announcement: announcement({ minVersion: '4.0.0', maxVersion: '4.9.9' })
			})
		).not.toThrow();
	});

	it('desactivar no borra: queda inactivo, con auditoría; repetirlo no hace nada', () => {
		const made = createAnnouncement(deps, { adminId, announcement: announcement() });

		const auditId = deactivateAnnouncement(deps, { adminId, id: made.id });
		expect(auditId).not.toBeNull();
		expect(listAnnouncements(deps)[0]?.active).toBe(false);
		expect(deactivateAnnouncement(deps, { adminId, id: made.id })).toBeNull();
		expect(
			f.db
				.select()
				.from(adminAudit)
				.all()
				.map((row) => row.action)
		).toEqual(['apps.announcement.create', 'apps.announcement.deactivate']);
	});

	it('desactivar uno que no existe responde NOT_FOUND', () => {
		expect(codeOf(() => deactivateAnnouncement(deps, { adminId, id: 'ann_inexistente' }))).toBe(
			'NOT_FOUND'
		);
	});
});
