// Auditoría contra SQLite real (T082; BE-FR-55; data-model 1.5): los triggers impiden modificar o borrar `admin_audit`
// y `prompt_templates`, y una instantánea con un dato sensible no deja ninguna fila a medio escribir.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import {
	addOperation,
	addSecondApp,
	appsTestContext,
	chatOperation,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { immediateTransaction } from '$lib/server/db/tx';
import { createTemplateVersion } from '../apps';
import { recordEntry } from './service';
import { adminAudit } from './schema';
import { promptTemplates } from '../apps/schema';

let database: TestDatabase | undefined;
let ctx: AppsTestContext;

beforeEach(() => {
	database = copyOfTemplate();
	ctx = appsTestContext(database.db);
});

afterEach(() => {
	database?.dispose();
	database = undefined;
});

function sqlite(): TestDatabase['sqlite'] {
	if (database === undefined) throw new Error('la prueba no tiene base de datos');
	return database.sqlite;
}

function writeAuditEntry(): string {
	return immediateTransaction(ctx.deps.db, (tx) =>
		recordEntry(
			tx,
			{
				adminId: ctx.adminId,
				action: 'apps.setting.update',
				entity: 'setting',
				entityId: 'max_text_chars',
				before: { value: 200_000 },
				after: { value: 150_000 },
				reason: 'Prueba de auditoría'
			},
			{ clock: ctx.deps.clock, ids: ctx.deps.ids, logger: ctx.deps.logger }
		)
	);
}

describe('admin_audit es de solo inserción (triggers)', () => {
	it('una entrada registrada no se puede actualizar', () => {
		writeAuditEntry();

		expect(() => sqlite().exec(`UPDATE admin_audit SET reason = 'alterado'`)).toThrow(
			'admin_audit is append-only'
		);
	});

	it('una entrada registrada no se puede borrar', () => {
		writeAuditEntry();

		expect(() => sqlite().exec(`DELETE FROM admin_audit`)).toThrow('admin_audit is append-only');
		expect(database?.db.select().from(adminAudit).all()).toHaveLength(1);
	});

	it('un valor con un email o una contraseña no se escribe: la transacción falla entera', () => {
		expect(() =>
			immediateTransaction(ctx.deps.db, (tx) =>
				recordEntry(
					tx,
					{
						adminId: ctx.adminId,
						action: 'accounts.block',
						entity: 'user',
						entityId: 'usr_x',
						before: null,
						after: { password: 'secreto' },
						reason: 'Prueba'
					},
					{ clock: ctx.deps.clock, ids: ctx.deps.ids, logger: ctx.deps.logger }
				)
			)
		).toThrow();
		expect(database?.db.select().from(adminAudit).all()).toHaveLength(0);
	});
});

describe('prompt_templates es inmutable por versión (triggers)', () => {
	function publishedTemplateId(): string {
		const appId = addSecondApp(ctx);
		const operationId = addOperation(ctx, appId, chatOperation('plantilla', { mode: 'plantilla' }));
		createTemplateVersion(ctx.deps, {
			actorId: ctx.adminId,
			operationId,
			body: { messages: [{ role: 'system', content: 'Eres un corrector.' }], variables: [] }
		});
		const [template] = database?.db.select().from(promptTemplates).all() ?? [];
		if (template === undefined) throw new Error('no se publicó la plantilla');
		return template.id;
	}

	it('una versión publicada no se puede actualizar', () => {
		const id = publishedTemplateId();

		expect(() =>
			sqlite().exec(`UPDATE prompt_templates SET version = 9 WHERE id = '${id}'`)
		).toThrow('prompt_templates is append-only');
	});

	it('una versión publicada no se puede borrar', () => {
		const id = publishedTemplateId();

		expect(() => sqlite().exec(`DELETE FROM prompt_templates WHERE id = '${id}'`)).toThrow(
			'prompt_templates is append-only'
		);
	});
});
