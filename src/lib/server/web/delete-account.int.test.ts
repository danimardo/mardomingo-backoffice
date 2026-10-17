// Acción `?/borrarCuenta` y modelo de vista de W29 contra la composición real y SQLite (T287; BE-FR-07, UX-07): la matriz de
// roles de la sesión, la contraseña errónea, la casilla sin marcar, un campo desconocido y las claves exactas del modelo de
// vista. Se llama a las funciones de `delete-account.ts` con entradas simples, sin levantar el servidor.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeLogger } from '../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID, TEMPLATE_DB } from '../../../../tests/setup/integration.global-setup';
import { parseEnv } from '$lib/server/config/env-schema';
import { createComposition, type Composition } from '$lib/server/composition';
import { account, session, user, userAppActivity } from '$lib/server/features/accounts/schema';
import type { SessionUser } from '$lib/server/features/accounts';
import { toEpochMs } from '$lib/shared/time';
import { deleteAccountView, submitDeleteAccount } from './delete-account';

const PASSWORD = 'contraseña-larga-123';

let composition: Composition;
let dir: string;
let hash: string;

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-borrado-'));
	const path = join(dir, 'app.db');
	copyFileSync(TEMPLATE_DB, path);
	composition = createComposition(
		parseEnv({
			APP_ENV: 'test',
			PUBLIC_API_URL: 'http://127.0.0.1:7312',
			PUBLIC_WEB_URL: 'http://localhost:7312',
			BETTER_AUTH_URL: 'http://localhost:7312',
			DATABASE_PATH: path,
			BETTER_AUTH_SECRET: 'a'.repeat(32),
			EMAIL_HASH_KEY: 'b'.repeat(32)
		}),
		createFakeLogger()
	);
	hash = await hashPassword(PASSWORD);
});

afterAll(() => {
	composition.close();
	rmSync(dir, { recursive: true, force: true });
});

interface Made {
	readonly id: string;
	readonly session: SessionUser;
}

/** Cuenta con credencial, bienvenida, actividad en la app sembrada y una sesión. */
function makeAccount(
	overrides: { role?: string; verified?: boolean; banned?: boolean } = {}
): Made {
	const id = `usr_${randomUUID().slice(0, 8)}`;
	const role = overrides.role ?? 'user';
	const verified = overrides.verified ?? true;
	const banned = overrides.banned ?? false;
	composition.db
		.insert(user)
		.values({
			id,
			name: '',
			email: `${id}@ejemplo.es`,
			role,
			emailVerified: verified,
			banned
		})
		.run();
	composition.db
		.insert(account)
		.values({
			id: `acc_${id}`,
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: hash
		})
		.run();
	composition.db
		.insert(session)
		.values({
			id: `ses_${id}`,
			userId: id,
			token: `token-${id}`,
			expiresAt: new Date(composition.clock.now() + 86_400_000)
		})
		.run();
	const now = toEpochMs(composition.clock.now());
	composition.db
		.insert(userAppActivity)
		.values({ userId: id, appId: SEEDED_APP_ID, firstLoginAt: now, lastUsedAt: now })
		.run();
	composition.credits.grantWelcome({ userId: id, emailNormalizedHash: `hash-${id}` });
	return {
		id,
		session: { id, email: `${id}@ejemplo.es`, emailVerified: verified, banned, role }
	};
}

function formFor(overrides: Record<string, string | undefined> = {}): FormData {
	const fields: Record<string, string | undefined> = {
		password: PASSWORD,
		confirmLoss: 'on',
		...overrides
	};
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) form.set(key, value);
	}
	return form;
}

function stillThere(id: string): boolean {
	const row = composition.db.select().from(user).where(eq(user.id, id)).get();
	return row !== undefined && row.deletedAt === null;
}

describe('acción ?/borrarCuenta de W29 (T287)', () => {
	it('un usuario verificado, tester o administrador borra su cuenta con la contraseña y la casilla', async () => {
		for (const role of ['user', 'user,tester', 'admin']) {
			const made = makeAccount({ role });

			const result = await submitDeleteAccount(composition, made.session, formFor(), new Headers());

			expect(result.kind, role).toBe('deleted');
			expect(stillThere(made.id), role).toBe(false);
			expect(
				composition.db.select().from(session).where(eq(session.userId, made.id)).all()
			).toEqual([]);
		}
	});

	it('sin sesión, sin verificar o bloqueado, se deniega y no se borra nada', async () => {
		const unverified = makeAccount({ verified: false });
		const blocked = makeAccount({ banned: true });

		const anonymous = await submitDeleteAccount(composition, null, formFor(), new Headers());
		const notVerified = await submitDeleteAccount(
			composition,
			unverified.session,
			formFor(),
			new Headers()
		);
		const banned = await submitDeleteAccount(
			composition,
			blocked.session,
			formFor(),
			new Headers()
		);

		expect(anonymous).toEqual({ kind: 'denied', access: { kind: 'anonymous' } });
		expect(notVerified).toEqual({ kind: 'denied', access: { kind: 'unverified' } });
		expect(banned).toEqual({ kind: 'denied', access: { kind: 'blocked' } });
		expect(stillThere(unverified.id)).toBe(true);
		expect(stillThere(blocked.id)).toBe(true);
	});

	it('con una contraseña errónea responde 400 WRONG_PASSWORD y no borra nada', async () => {
		const made = makeAccount();

		const result = await submitDeleteAccount(
			composition,
			made.session,
			formFor({ password: 'otra-contraseña-distinta' }),
			new Headers()
		);

		expect(result.kind).toBe('failure');
		if (result.kind !== 'failure') throw new Error('debía fallar');
		expect(result.failure.status).toBe(400);
		expect(result.failure.data).toMatchObject({ formError: 'WRONG_PASSWORD' });
		expect(JSON.stringify(result.failure.data)).not.toContain('distinta');
		expect(stillThere(made.id)).toBe(true);
		expect(composition.credits.getBalance(made.id).totalMicro).toBeGreaterThan(0);
	});

	it('con la casilla sin marcar responde 400 con el error en la casilla y no borra nada', async () => {
		const made = makeAccount();

		const result = await submitDeleteAccount(
			composition,
			made.session,
			formFor({ confirmLoss: undefined }),
			new Headers()
		);

		expect(result.kind).toBe('failure');
		if (result.kind !== 'failure') throw new Error('debía fallar');
		expect(result.failure.status).toBe(400);
		const data = result.failure.data;
		expect('errors' in data ? Object.keys(data.errors) : []).toEqual(['confirmLoss']);
		expect(stillThere(made.id)).toBe(true);
	});

	it('sin contraseña o con un campo desconocido, responde 400 y no borra nada', async () => {
		const made = makeAccount();

		const missing = await submitDeleteAccount(
			composition,
			made.session,
			formFor({ password: undefined }),
			new Headers()
		);
		const extra = await submitDeleteAccount(
			composition,
			made.session,
			formFor({ userId: 'usr_de_otra_cuenta' }),
			new Headers()
		);

		for (const result of [missing, extra]) {
			expect(result.kind).toBe('failure');
			if (result.kind !== 'failure') throw new Error('debía fallar');
			expect(result.failure.status).toBe(400);
		}
		expect(stillThere(made.id)).toBe(true);
	});

	it('borra la cuenta de la sesión, nunca la de otra aunque el formulario la nombre', async () => {
		const mine = makeAccount();
		const other = makeAccount();

		const result = await submitDeleteAccount(
			composition,
			mine.session,
			formFor({ userId: other.id }),
			new Headers()
		);

		expect(result.kind).toBe('failure');
		expect(stillThere(mine.id)).toBe(true);
		expect(stillThere(other.id)).toBe(true);
	});
});

describe('modelo de vista de W29 (T287)', () => {
	it('tiene exactamente las claves del contrato: loss y affectedApps', () => {
		const made = makeAccount();

		const view = deleteAccountView(composition, made.id);

		expect(Object.keys(view).sort()).toEqual(['affectedApps', 'loss']);
		expect(Object.keys(view.loss).sort()).toEqual(['eurEquivalentCents', 'totalMicro']);
	});

	it('el saldo que se pierde es el de las bolsas, con su equivalencia en euros, y las apps afectadas son las usadas', () => {
		const made = makeAccount();
		const balance = composition.credits.getBalance(made.id);

		const view = deleteAccountView(composition, made.id);

		expect(view.loss.totalMicro).toBe(balance.freeMicro + balance.paidMicro);
		expect(view.loss.totalMicro).toBeGreaterThan(0);
		expect(view.loss.eurEquivalentCents).toBeGreaterThan(0);
		expect(view.affectedApps).toEqual(['Secretario AI']);
	});

	it('una cuenta sin saldo ni apps no pierde nada y no afecta a ninguna app', () => {
		const id = `usr_${randomUUID().slice(0, 8)}`;
		composition.db
			.insert(user)
			.values({ id, name: '', email: `${id}@ejemplo.es`, emailVerified: true })
			.run();

		const view = deleteAccountView(composition, id);

		expect(view).toEqual({ loss: { totalMicro: 0, eurEquivalentCents: 0 }, affectedApps: [] });
	});
});
