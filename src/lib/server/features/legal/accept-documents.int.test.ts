// Aceptación de documentos pendientes contra SQLite real (T276, T277; BE-FR-70/CA1–CA2): la versión vigente se registra una vez
// (idempotente), una versión no vigente se rechaza con LEGAL_VERSION_CHANGED y no escribe nada.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { toEpochMs } from '$lib/shared/time';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { termsAcceptances } from './schema';
import { acceptDocuments, currentVersions } from './index';

const NOW = Date.now();
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	// Reloj real: las versiones sembradas se publican a la hora de construir la plantilla.
	f = creditsFixture(Date.now());
	userId = f.addUser('usr_legal_acepta');
});

afterEach(() => {
	f.close();
});

function legalDeps() {
	return { db: f.db, logger: f.logger, ids: createIdGenerator(seededRandomBytes(91)) };
}

function vigente(document: 'terms' | 'privacy'): string {
	const current = currentVersions(legalDeps(), toEpochMs(f.clock.now()), [document]).get(document);
	if (current === undefined) throw new Error('la versión debía estar sembrada');
	return current.version;
}

function rowsOf(document: 'terms' | 'privacy') {
	return f.db
		.select()
		.from(termsAcceptances)
		.where(eq(termsAcceptances.userId, userId))
		.all()
		.filter((row) => row.document === document);
}

describe('acceptDocuments (BE-FR-70)', () => {
	it('registra la versión vigente con fecha, IP y app nula', () => {
		acceptDocuments(legalDeps(), {
			userId,
			ip: '203.0.113.9',
			now: toEpochMs(NOW),
			accepted: [{ document: 'terms', version: vigente('terms') }]
		});

		expect(rowsOf('terms')).toEqual([
			expect.objectContaining({ version: vigente('terms'), ip: '203.0.113.9', appId: null })
		]);
	});

	it('aceptar dos veces la misma versión no duplica', () => {
		const accepted = [{ document: 'privacy' as const, version: vigente('privacy') }];
		acceptDocuments(legalDeps(), { userId, ip: null, now: toEpochMs(NOW), accepted });
		acceptDocuments(legalDeps(), { userId, ip: null, now: toEpochMs(NOW), accepted });

		expect(rowsOf('privacy')).toHaveLength(1);
	});

	it('una versión que ya no es la vigente se rechaza y no escribe nada', () => {
		expect(() =>
			acceptDocuments(legalDeps(), {
				userId,
				ip: null,
				now: toEpochMs(NOW),
				accepted: [{ document: 'terms', version: '1999-01-01' }]
			})
		).toThrow();
		expect(rowsOf('terms')).toEqual([]);
	});
});
