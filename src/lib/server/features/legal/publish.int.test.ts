// Publicación de versiones legales contra SQLite real (BE-FR-70, BE-FR-26; T314): la versión se guarda con su hash y su bandera de
// reaceptación, queda vigente a su fecha, no se puede repetir (versión única por documento), el contenido no puede estar vacío,
// queda auditada, y solo las direcciones de cuentas verificadas reciben el aviso.
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { adminAudit } from '../audit/schema';
import { user } from '../accounts/schema';
import { verifiedUserEmails } from '../accounts';
import { legalDocuments } from './schema';
import { currentVersions } from './service';
import { publishVersion } from './publish';

let f: CreditsFixture;
let adminId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_legal', 'admin');
});

afterEach(() => {
	f.close();
});

function publish(overrides: Partial<Parameters<typeof publishVersion>[1]> = {}) {
	return publishVersion(
		{
			db: f.db,
			logger: f.logger,
			clock: f.clock,
			ids: f.deps.ids,
			audit: { clock: f.clock, ids: f.deps.ids, logger: f.logger }
		},
		{
			adminId,
			document: 'terms',
			version: '2026-11-01',
			content: '# Términos\n\nNuevo texto.',
			requiresReacceptance: false,
			...overrides
		}
	);
}

describe('publicación de versiones legales (T314)', () => {
	it('guarda la versión con su hash y su bandera de reaceptación', () => {
		publish({ requiresReacceptance: true });

		const row = f.db
			.select()
			.from(legalDocuments)
			.where(eq(legalDocuments.version, '2026-11-01'))
			.get();
		expect(row).toMatchObject({
			document: 'terms',
			version: '2026-11-01',
			requiresReacceptance: true,
			createdBy: adminId
		});
		expect(row?.contentHash).toBe(
			createHash('sha256').update('# Términos\n\nNuevo texto.', 'utf8').digest('hex')
		);
	});

	it('la versión queda vigente a su fecha de publicación y sustituye a la anterior', () => {
		publish();

		const now = f.clock.now();
		expect(currentVersions({ db: f.db }, now, ['terms']).get('terms')?.version).toBe('2026-11-01');
	});

	it('no se puede publicar dos veces la misma versión del mismo documento', () => {
		publish();

		expect(() => publish()).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
	});

	it('el contenido vacío o la versión con otro formato no se aceptan', () => {
		expect(() => publish({ content: '   ' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
		expect(() => publish({ version: 'v2' })).toThrow(
			expect.objectContaining({ code: 'VALIDATION_ERROR' })
		);
	});

	it('la publicación queda auditada con el documento y la versión', () => {
		publish();

		expect(f.db.select().from(adminAudit).all()).toEqual([
			expect.objectContaining({
				action: 'legal.document.publish',
				entity: 'legal_document',
				entityId: 'terms:2026-11-01',
				adminId
			})
		]);
	});

	it('el aviso llega solo a las direcciones de cuentas verificadas', () => {
		f.addUser('usr_verificado');
		f.db.update(user).set({ emailVerified: true }).where(eq(user.id, 'usr_verificado')).run();
		f.addUser('usr_sin_verificar');
		f.db
			.update(user)
			.set({ deletedAt: f.clock.now() })
			.where(eq(user.id, 'usr_sin_verificar'))
			.run();

		expect(verifiedUserEmails({ db: f.db })).toEqual(['usr_verificado@ejemplo.es']);
	});
});
