// Siembra de la base del E2E para el panel (T250; Historias 15.22). Crea la cuenta de `panelAccountFixture` con los servicios
// (bolsas, reserva, deuda, operaciones en sus estados y perfil fiscal) y la guarda en la base que arranca el servidor E2E,
// con un email y una contraseña conocidos. Solo corre si `playwright.config.ts` ha dejado la petición en
// `test-results/e2e/seed-pending.txt` (con la ruta de la base); en un `pnpm test` normal no existe y no hace nada.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
	E2E_LOGINS_PER_IP_15MIN,
	E2E_REGISTRATIONS_PER_IP_24H,
	PANEL_E2E_EMAIL,
	PANEL_E2E_PASSWORD
} from '../../e2e/constants';
import { recordEntry } from '$lib/server/features/audit';
import { immediateTransaction } from '$lib/server/db/tx';
import { createIdGenerator } from '$lib/server/shared/ids';
import { seededRandomBytes } from '../builders/ids';
import { panelAccountFixture } from '../builders/panel-account';

const REQUEST_FILE = join('test-results', 'e2e', 'seed-pending.txt');

describe.skipIf(!existsSync(REQUEST_FILE))('siembra del panel para el E2E (T250)', () => {
	it('guarda la cuenta del panel con email y contraseña conocidos en la base del servidor', async () => {
		const target = readFileSync(REQUEST_FILE, 'utf8');
		const account = panelAccountFixture();
		const base = account.fixture.base;
		// Una entrada de auditoría con el servicio, para que la ficha `/admin/auditoria/[entryId]` tenga una a la que ir
		// aunque la prueba corra aislada (T314). El administrador que la registra no tiene rol: solo es una referencia.
		const auditor = base.addUser('usr_auditoria_e2e', 'user');
		immediateTransaction(base.db, (tx) =>
			recordEntry(
				tx,
				{
					adminId: auditor,
					action: 'credits.adjust',
					entity: 'user',
					entityId: account.userId,
					before: null,
					after: null,
					reason: 'Entrada de prueba E2E'
				},
				{ clock: base.clock, ids: createIdGenerator(seededRandomBytes(67)), logger: base.logger }
			)
		);
		const { database } = base;
		try {
			// La copia de seguridad de SQLite deja una base migrada y sembrada con los datos del fixture.
			await database.sqlite.backup(target);
		} finally {
			database.dispose();
		}

		const db = new Database(target);
		try {
			db.prepare(
				`UPDATE user SET name = 'Ana Pérez', email = ?, email_normalized = ?, email_verified = 1, role = 'user'
				 WHERE id = ?`
			).run(PANEL_E2E_EMAIL, PANEL_E2E_EMAIL, account.userId);
			db.prepare(
				`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
				 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
			).run(
				`acc_${account.userId}`,
				account.userId,
				account.userId,
				await hashPassword(PANEL_E2E_PASSWORD),
				Date.now(),
				Date.now()
			);
			// Los límites por IP los fija el arranque solo si faltan; la copia de la plantilla ya trae los de producción.
			const setLimit = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
			setLimit.run(String(E2E_REGISTRATIONS_PER_IP_24H), 'registrations_per_ip_24h');
			setLimit.run(String(E2E_LOGINS_PER_IP_15MIN), 'login_per_ip_15min');
			const row = db
				.prepare('SELECT COUNT(*) AS total FROM credit_buckets WHERE user_id = ?')
				.pluck()
				.get(account.userId);
			expect(row).toBeGreaterThan(0);
		} finally {
			db.close();
			rmSync(REQUEST_FILE, { force: true });
		}
	});
});
