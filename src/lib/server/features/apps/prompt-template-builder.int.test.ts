// El constructor de plantillas (T173) crea la operación y su primera versión con el servicio de `apps` contra SQLite real
// (BE-FR-78, 79): la versión sube sin editar la anterior y la operación queda inactiva hasta que la active el administrador.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { createFakeLogger } from '../../../../../tests/builders/fake-logger';
import { mutableClock } from '../../../../../tests/builders/clock';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { seededPromptTemplate } from '../../../../../tests/builders/prompt-template';
import { appOperations, promptTemplates } from './schema';
import { createTemplateVersion, type AppsDeps } from './service';
import { insertAdmin } from '../../../../../tests/builders/apps';

let database: TestDatabase;
let deps: AppsDeps;

beforeEach(() => {
	database = copyOfTemplate();
	deps = {
		db: database.db,
		logger: createFakeLogger(),
		clock: mutableClock(Date.now()),
		ids: createIdGenerator(seededRandomBytes(7))
	};
});

afterEach(() => {
	database.dispose();
});

describe('constructor de plantillas por servicio (BE-FR-78, 79)', () => {
	it('crea una operación plantilla inactiva con su versión 1', () => {
		const adminId = insertAdmin(database.db);

		const created = seededPromptTemplate(deps, adminId);

		expect(created.version).toBe(1);
		const operation = database.db
			.select()
			.from(appOperations)
			.where(eq(appOperations.id, created.operationId))
			.get();
		expect(operation?.mode).toBe('plantilla');
		expect(operation?.active).toBe(false);
	});

	it('una versión nueva sube el número y no edita la anterior', () => {
		const adminId = insertAdmin(database.db);
		const created = seededPromptTemplate(deps, adminId);

		const next = createTemplateVersion(deps, {
			actorId: adminId,
			operationId: created.operationId,
			body: {
				messages: [{ role: 'user', content: 'Texto fijo' }],
				variables: []
			}
		});

		expect(next).toBe(2);
		const rows = database.db
			.select()
			.from(promptTemplates)
			.where(eq(promptTemplates.operationId, created.operationId))
			.all();
		expect(rows.map((row) => row.version).sort()).toEqual([1, 2]);
	});
});
