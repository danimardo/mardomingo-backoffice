// Informe contable de W50–W51 contra la composición real y SQLite (BE-FR-76; T316): un periodo sin movimientos produce CSV con solo
// cabecera, cero compras y cero operaciones sin convertir. Las compras con su lectura y las simuladas excluidas de ingresos las
// prueban `payments/payment-facts.int.test.ts` y las pruebas de `invoicing`.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeLogger } from '../../../../tests/builders/fake-logger';
import { TEMPLATE_DB } from '../../../../tests/setup/integration.global-setup';
import { parseEnv } from '$lib/server/config/env-schema';
import { createComposition, type Composition } from '$lib/server/composition';
import { currentVersions, recordWithdrawalWaiver } from '$lib/server/features/legal';
import { toEpochMs } from '$lib/shared/time';
import { accountingReport } from './accounting-report';

let composition: Composition;
let dir: string;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-contable-'));
	const path = join(dir, 'app.db');
	copyFileSync(TEMPLATE_DB, path);
	composition = createComposition(
		parseEnv({
			APP_ENV: 'test',
			PUBLIC_API_URL: 'http://127.0.0.1:7313',
			PUBLIC_WEB_URL: 'http://localhost:7313',
			BETTER_AUTH_URL: 'http://localhost:7313',
			DATABASE_PATH: path,
			BETTER_AUTH_SECRET: 'a'.repeat(32),
			EMAIL_HASH_KEY: 'b'.repeat(32)
		}),
		createFakeLogger()
	);
});

afterAll(() => {
	composition.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('informe contable de un periodo sin movimientos (T316)', () => {
	const period = { fromMs: Date.UTC(2020, 0, 1), toMs: Date.UTC(2020, 0, 31, 23, 59, 59) };

	it('no tiene compras, ni operaciones sin convertir, y su CSV de ventas es solo cabecera', () => {
		const report = accountingReport(composition, period);

		expect(report.purchases).toBe(0);
		expect(report.unconverted).toBe(0);
		expect(report.export.salesCsv.trim().split('\n')).toHaveLength(1);
	});

	it('el CSV mensual y el de coste de IA también existen aunque el periodo esté vacío', () => {
		const report = accountingReport(composition, period);

		expect(report.export.monthlyCsv.length).toBeGreaterThan(0);
		expect(report.export.aiCostsCsv.length).toBeGreaterThan(0);
	});
});

describe('compra simulada en el informe del periodo (T316)', () => {
	it('una compra simulada cuenta como compra del periodo pero no genera filas de ingresos', () => {
		const now = composition.clock.now();
		const userId = 'usr_informe_compra';
		const stamp = Number(now);
		composition.sqlite
			.prepare(
				`INSERT INTO user (id, name, email, email_verified, role, banned, created_at, updated_at)
				 VALUES (?, '', ?, 1, 'user', 0, ?, ?)`
			)
			.run(userId, 'informe.compra@ejemplo.es', stamp, stamp);
		composition.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-informe-compra' });
		const version = currentVersions(composition.legal, toEpochMs(now), ['withdrawal_waiver']).get(
			'withdrawal_waiver'
		)?.version;
		if (version === undefined) throw new Error('la renuncia debía estar sembrada');
		const waiverId = recordWithdrawalWaiver(composition.legal, {
			userId,
			appId: null,
			ip: null,
			now: toEpochMs(now),
			version
		});

		const bought = composition.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_informe_compra',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});
		expect(bought.status).toBe('completed');

		const report = accountingReport(composition, {
			fromMs: Date.UTC(2000, 0, 1),
			toMs: Date.UTC(2100, 0, 1)
		});

		expect(report.purchases).toBe(1);
		expect(report.export.salesCsv.trim().split('\n')).toHaveLength(1);
		expect(report.export.monthlyCsv.trim().split('\n')).toHaveLength(1);
	});
});
