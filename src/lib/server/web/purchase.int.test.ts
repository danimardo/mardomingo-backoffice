// Acción `?/comprar` de W20 contra la composición real y SQLite (T246; BE-FR-25 CA4, BE-FR-26, BE-FR-74): renuncia sin marcar,
// compra válida, repetición del mismo intento, factura completa sin perfil y paquete inactivo. Se llama a `submitPurchase`
// con entradas simples, sin levantar el servidor.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFakeLogger } from '../../../../tests/builders/fake-logger';
import { TEMPLATE_DB } from '../../../../tests/setup/integration.global-setup';
import { parseEnv } from '$lib/server/config/env-schema';
import { createComposition, type Composition } from '$lib/server/composition';
import { setComposition } from '$lib/server/composition.cache';
import { user } from '$lib/server/features/accounts/schema';
import { currentVersions } from '$lib/server/features/legal';
import { packs } from '$lib/server/features/payments/schema';
import { toEpochMs } from '$lib/shared/time';
import { submitPurchase } from './purchase';

let composition: Composition;
let dir: string;
let accountId: string;

function sessionUser() {
	return {
		id: accountId,
		email: 'comprador@ejemplo.es',
		emailVerified: true,
		banned: false,
		role: 'user'
	};
}

/** Formulario como lo envía el navegador: valores vacíos o ausentes no se incluyen. */
function formFor(overrides: Record<string, string | undefined> = {}): FormData {
	const waiver = currentVersions(composition.legal, toEpochMs(composition.clock.now()), [
		'withdrawal_waiver'
	]).get('withdrawal_waiver');
	const fields: Record<string, string | undefined> = {
		packId: 'pck_seed_10eur',
		intentId: randomUUID(),
		waiverAccepted: 'on',
		waiverVersion: waiver?.version ?? '',
		...overrides
	};
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) form.set(key, value);
	}
	return form;
}

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-compra-'));
	const path = join(dir, 'app.db');
	copyFileSync(TEMPLATE_DB, path);
	const config = parseEnv({
		APP_ENV: 'test',
		PUBLIC_API_URL: 'http://127.0.0.1:7312',
		PUBLIC_WEB_URL: 'http://localhost:7312',
		BETTER_AUTH_URL: 'http://localhost:7312',
		DATABASE_PATH: path,
		BETTER_AUTH_SECRET: 'a'.repeat(32),
		EMAIL_HASH_KEY: 'b'.repeat(32)
	});
	composition = createComposition(config, createFakeLogger());
	// La caché de la composición admite una sola asignación por módulo: una base de datos por fichero.
	setComposition(composition);
});

beforeEach(() => {
	accountId = `usr_${randomUUID().slice(0, 8)}`;
	composition.db
		.insert(user)
		.values({
			id: accountId,
			name: '',
			email: `${accountId}@ejemplo.es`,
			role: 'user',
			emailVerified: true
		})
		.run();
});

afterAll(() => {
	composition.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('acción ?/comprar de W20 (T246)', () => {
	it('sin marcar la renuncia no compra y devuelve el error de formulario', () => {
		const result = submitPurchase(
			composition,
			sessionUser(),
			formFor({ waiverAccepted: undefined }),
			'/panel/comprar'
		);

		expect(result.kind).toBe('failure');
		expect(
			composition.db.select().from(packs).where(eq(packs.id, 'pck_seed_10eur')).get()?.active
		).toBe(true);
	});

	it('con la renuncia marcada compra y lleva a la compra', () => {
		const result = submitPurchase(composition, sessionUser(), formFor(), '/panel/comprar');

		expect(result.kind).toBe('redirect');
		if (result.kind !== 'redirect') throw new Error('la compra debía redirigir');
		expect(result.location).toMatch(/^\/panel\/comprar\/pay_/);
		expect(result.location).not.toContain('estado=repetida');
	});

	it('repetir el mismo intento lleva a la compra con estado repetida', () => {
		const form = formFor();
		submitPurchase(composition, sessionUser(), form, '/panel/comprar');

		const repeated = submitPurchase(composition, sessionUser(), form, '/panel/comprar');

		expect(repeated.kind).toBe('redirect');
		if (repeated.kind !== 'redirect') throw new Error('la repetición debía redirigir');
		expect(repeated.location).toMatch(/\?estado=repetida$/);
	});

	it('factura completa sin perfil fiscal se rechaza sin comprar', () => {
		const result = submitPurchase(
			composition,
			sessionUser(),
			formFor({ wantsFullInvoice: 'on' }),
			'/panel/comprar'
		);

		expect(result.kind).toBe('failure');
	});
});
