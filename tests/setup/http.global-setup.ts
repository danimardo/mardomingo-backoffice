// Arranca la aplicación construida para las pruebas HTTP (T035, R16). Elige un puerto libre, usa una BD temporal
// y secretos aleatorios, y espera a que el healthcheck responda. El proceso se lanza sin shell.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { send } from '../http/client';
import { startOpenRouterMock } from '../mock-servers/openrouter';
import { openDatabase } from '$lib/server/db/client';
import { createSystemClock } from '$lib/server/adapters/clock/clock';
import { session, user } from '$lib/server/features/accounts/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import { createFakeLogger } from '../builders/fake-logger';
import { seededRandomBytes } from '../builders/ids';
import {
	activateChatOperation,
	acceptCurrentLegal,
	grantChatWelcome
} from '../builders/chat-account';
import { SEEDED_APP_ID } from './integration.global-setup';

declare module 'vitest' {
	export interface ProvidedContext {
		httpBaseUrl: string;
		/** Token Bearer de la cuenta de chat sembrada (T178). */
		httpChatToken: string;
		/** Simulador de OpenRouter que usa el servidor construido (T178). */
		openrouterMockUrl: string;
	}
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CHAT_USER_ID = 'usr_http_chat';

const DIR = join('tests', '.tmp', 'http');

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.unref();
		probe.on('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('No se pudo reservar un puerto libre.'));
				return;
			}
			probe.close(() => {
				resolve(address.port);
			});
		});
	});
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const result = await send(baseUrl, '/api/v1/health');
			if (result.status === 200) return;
		} catch {
			// Aún no escucha: se reintenta.
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`La aplicación no respondió en ${String(timeoutMs)} ms.`);
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
	if (!existsSync(join('build', 'index.js'))) {
		const built = spawnSync('pnpm', ['build'], { shell: true, stdio: 'inherit' });
		if (built.status !== 0) throw new Error('Falló la construcción para las pruebas HTTP.');
	}

	rmSync(DIR, { recursive: true, force: true });
	mkdirSync(DIR, { recursive: true });
	const port = await freePort();
	const baseUrl = `http://127.0.0.1:${String(port)}`;
	const secret = randomBytes(32).toString('hex');

	const openrouter = await startOpenRouterMock();
	const child: ChildProcess = spawn(process.execPath, [join('build', 'index.js')], {
		env: {
			APP_ENV: 'test',
			PORT: String(port),
			HOST: '127.0.0.1',
			PUBLIC_API_URL: baseUrl,
			PUBLIC_WEB_URL: `http://localhost:${String(port)}`,
			BETTER_AUTH_URL: `http://localhost:${String(port)}`,
			DATABASE_PATH: join(DIR, 'app.db'),
			BETTER_AUTH_SECRET: secret,
			EMAIL_HASH_KEY: randomBytes(32).toString('hex'),
			LOG_LEVEL: 'debug',
			MOCK_OPENROUTER_URL: openrouter.url
		},
		stdio: 'ignore'
	});

	await waitForHealth(baseUrl, 30_000);
	project.provide('httpBaseUrl', baseUrl);
	// La base la migra y la siembra el propio servidor al arrancar; la cuenta de chat se escribe después, en la misma base.
	const chatToken = randomBytes(32).toString('hex');
	seedChatAccount(join(DIR, 'app.db'), chatToken);
	project.provide('httpChatToken', chatToken);
	project.provide('openrouterMockUrl', openrouter.url);

	return async () => {
		// En Windows la BD sigue abierta hasta que el proceso termina: se espera antes de borrarla.
		await new Promise<void>((resolve) => {
			child.once('exit', () => {
				resolve();
			});
			child.kill();
		});
		await openrouter.close();
		rmSync(DIR, { recursive: true, force: true });
	};
}

/**
 * Cuenta verificada con una sesión de la app `secretario`, la operación de chat activa, la aceptación vigente de los
 * documentos legales y la bienvenida. El token Bearer es la propia `session.token`: el servidor lo firma al leerlo.
 */
function seedChatAccount(file: string, token: string): void {
	const { sqlite, db } = openDatabase(file);
	try {
		const clock = createSystemClock();
		const now = new Date(clock.now());
		db.insert(user)
			.values({
				id: CHAT_USER_ID,
				email: 'chat@ejemplo.es',
				emailNormalized: 'chat@ejemplo.es',
				emailVerified: true,
				createdAt: now,
				updatedAt: now
			})
			.run();
		db.insert(session)
			.values({
				id: 'ses_http_chat',
				userId: CHAT_USER_ID,
				token,
				expiresAt: new Date(now.getTime() + 30 * DAY_MS),
				appId: SEEDED_APP_ID,
				deviceName: 'Prueba HTTP',
				appVersion: '4.0.0',
				createdAt: now,
				updatedAt: now
			})
			.run();
		const deps = {
			db,
			logger: createFakeLogger(),
			clock,
			ids: createIdGenerator(seededRandomBytes(91))
		};
		activateChatOperation(db);
		grantChatWelcome(deps, CHAT_USER_ID);
		acceptCurrentLegal(deps, CHAT_USER_ID);
	} finally {
		sqlite.close();
	}
}
