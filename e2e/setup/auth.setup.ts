// Estados de sesión para las pruebas E2E (T112; 15.17). Crea en la base de la ejecución las cuentas `user`, `admin` y
// `blocked`, entra por el login real con la petición de Playwright (sin navegador) y guarda cada `storageState` en
// `e2e/.auth/`. `anonymous` es un estado vacío. El servidor ya está arriba cuando corre este proyecto (webServer).
// Un solo administrador por base (índice `one_admin`): por eso la base es nueva en cada ejecución.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { request as playwrightRequest, test as setup } from '@playwright/test';
import { PASSWORD } from '../outbox';

const AUTH_DIR = join('e2e', '.auth');
const DB_POINTER = join('test-results', 'e2e', 'db-path.txt');

interface Account {
	readonly name: 'user' | 'admin' | 'blocked';
	readonly id: string;
	readonly email: string;
	readonly role: 'user' | 'admin';
	readonly banned: boolean;
}

const ACCOUNTS: readonly Account[] = [
	{
		name: 'user',
		id: 'usr_e2e_user',
		email: 'usuario.e2e@ejemplo.es',
		role: 'user',
		banned: false
	},
	{
		name: 'admin',
		id: 'usr_e2e_admin',
		email: 'admin.e2e@ejemplo.es',
		role: 'admin',
		banned: false
	},
	{
		name: 'blocked',
		id: 'usr_e2e_blocked',
		email: 'bloqueado.e2e@ejemplo.es',
		role: 'user',
		banned: true
	}
];

async function insertAccount(databasePath: string, account: Account): Promise<void> {
	const db = new Database(databasePath);
	try {
		const now = Date.now();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, ?, ?, ?, ?, ?)`
		).run(account.id, account.email, account.role, account.banned ? 1 : 0, account.email, now, now);
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
		).run(`acc_${account.id}`, account.id, account.id, await hashPassword(PASSWORD), now, now);
	} finally {
		db.close();
	}
}

setup('estados de sesión de user, admin y blocked', async ({ baseURL }) => {
	const origin = new URL(baseURL ?? 'http://localhost:7390').origin;
	const databasePath = readFileSync(DB_POINTER, 'utf8');
	mkdirSync(AUTH_DIR, { recursive: true });

	writeFileSync(
		join(AUTH_DIR, 'anonymous.json'),
		JSON.stringify({ cookies: [], origins: [] }, null, 2)
	);

	for (const account of ACCOUNTS) {
		await insertAccount(databasePath, account);
		const context = await playwrightRequest.newContext({ baseURL: origin });
		try {
			await context.post('/login?/entrar', {
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					accept: 'text/html',
					origin
				},
				form: { email: account.email, password: PASSWORD, redirectTo: '/panel' },
				maxRedirects: 0
			});
			await context.storageState({ path: join(AUTH_DIR, `${account.name}.json`) });
		} finally {
			await context.dispose();
		}
	}
});
