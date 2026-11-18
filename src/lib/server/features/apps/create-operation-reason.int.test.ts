// C-57 (T448; BE-FR-55, BE-FR-77): el alta de una operación exige un motivo de 1 a 500 caracteres tras recortar, como el resto de
// acciones de administración (C-55), y su entrada de auditoría guarda el motivo recortado. Sin motivo válido no se crea nada ni
// se audita.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import {
	appsTestContext,
	chatOperation,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { adminAudit } from '../audit/schema';
import { appOperations } from './schema';
import { createOperation } from './service';

const KEY = 'op_c57_motivo';

let f: CreditsFixture;
let ctx: AppsTestContext;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 10, 18, 9, 0, 0));
	ctx = appsTestContext(f.db, 57);
});

afterEach(() => {
	f.close();
});

function createdOperations() {
	return f.db.select().from(appOperations).where(eq(appOperations.key, KEY)).all();
}

function createAudits() {
	return f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.create')).all();
}

describe('C-57 · motivo del alta de una operación (BE-FR-55)', () => {
	it.each([
		['vacío', ''],
		['en blanco', '   '],
		['de 501 caracteres', 'm'.repeat(501)]
	])(
		'con un motivo %s lanza VALIDATION_ERROR en reason, sin crear ni auditar',
		(_label, reason) => {
			const before = createAudits().length;

			expect(() =>
				createOperation(ctx.deps, ctx.adminId, SEEDED_APP_ID, chatOperation(KEY, { reason }))
			).toThrow(
				expect.objectContaining({ code: 'VALIDATION_ERROR', details: { field: 'reason' } })
			);

			expect(createdOperations()).toEqual([]);
			expect(createAudits()).toHaveLength(before);
		}
	);

	it('audita el motivo recortado y devuelve el id de esa entrada', () => {
		const { id, entryId } = createOperation(
			ctx.deps,
			ctx.adminId,
			SEEDED_APP_ID,
			chatOperation(KEY, { reason: `  Nueva operación de prueba  ` })
		);

		expect(createdOperations().map((row) => row.id)).toEqual([id]);
		const entry = f.db.select().from(adminAudit).where(eq(adminAudit.id, entryId)).get();
		expect(entry).toMatchObject({
			action: 'apps.operation.create',
			entityId: id,
			reason: 'Nueva operación de prueba'
		});
	});

	it('un motivo de 500 caracteres tras recortar sí vale', () => {
		const reason = 'm'.repeat(500);

		const { entryId } = createOperation(
			ctx.deps,
			ctx.adminId,
			SEEDED_APP_ID,
			chatOperation(KEY, { reason: `  ${reason}  ` })
		);

		expect(f.db.select().from(adminAudit).where(eq(adminAudit.id, entryId)).get()?.reason).toBe(
			reason
		);
	});
});
