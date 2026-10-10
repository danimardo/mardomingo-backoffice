// Arranca la aplicación construida para las pruebas HTTP (T035, R16). Elige un puerto libre, usa una BD temporal
// y secretos aleatorios, y espera a que el healthcheck responda. El proceso se lanza sin shell.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { send } from '../http/client';

declare module 'vitest' {
	export interface ProvidedContext {
		httpBaseUrl: string;
	}
}

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
			LOG_LEVEL: 'debug'
		},
		stdio: 'ignore'
	});

	await waitForHealth(baseUrl, 30_000);
	project.provide('httpBaseUrl', baseUrl);

	return async () => {
		// En Windows la BD sigue abierta hasta que el proceso termina: se espera antes de borrarla.
		await new Promise<void>((resolve) => {
			child.once('exit', () => {
				resolve();
			});
			child.kill();
		});
		rmSync(DIR, { recursive: true, force: true });
	};
}
