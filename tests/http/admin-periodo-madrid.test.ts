// A-01 · Los periodos del panel (facturación, exportación contable, estadísticas y filtro de auditoría) se cortan en días UTC,
// no en días de Madrid (Historias.md 4.3: «los cortes diarios (topes, estadísticas) usan la zona Europe/Madrid»; BE-FR-76
// «por periodo»; BE-FR-54). `bounds()` usa `Date.parse(`${desde}T00:00:00Z`)` y `${hasta}T23:59:59Z`, mientras que la
// fecha de cada fila del CSV es el día civil de Madrid (`civilDateOf`). Resultado: una venta del 1 de febrero a las 00:30 de
// Madrid (31-ene 23:30 UTC) no sale en el periodo 01-02..01-02, y una del 2 de febrero a las 00:30 de Madrid sí sale en él,
// con fecha «2026-02-02» en un CSV del día 1. Además el fin `23:59:59.000Z` deja fuera el último segundo (.001–.999).
//
// Destino en el repo: tests/http/admin-periodo-madrid.test.ts
// Ejecutar: pnpm build; pnpm exec vitest run --project http tests/http/admin-periodo-madrid.test.ts
// Debe FALLAR hoy: la primera aserción (incluye la venta de las 00:30 de Madrid del día 1) y la segunda (excluye la del día 2).
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const BUYER = 'usr_http_a01_comprador';

// 2026-02-01 00:30 en Madrid (CET, UTC+1) = 2026-01-31 23:30 UTC: es venta del día 1 de febrero.
const DAY1_MADRID = Date.UTC(2026, 0, 31, 23, 30, 0);
// 2026-02-02 00:30 en Madrid = 2026-02-01 23:30 UTC: es venta del día 2, no del 1.
const DAY2_MADRID = Date.UTC(2026, 1, 1, 23, 30, 0);
const PAY_DAY1 = 'pay_http_a01_dia1';
const PAY_DAY2 = 'pay_http_a01_dia2';

let admin: AdminSession;

function insertPayment(
	db: Database.Database,
	input: { id: string; createdAt: number; providerRef: string; packId: string }
): void {
	const waiver = `tac_${input.id}`;
	db.prepare(
		`INSERT INTO terms_acceptances (id, user_id, document, version, accepted_at)
		 VALUES (?, ?, 'withdrawal_waiver', '1', ?)`
	).run(waiver, BUYER, input.createdAt);
	db.prepare(
		`INSERT INTO payments (id, user_id, pack_id, attempt_id, provider, provider_ref, status, amount_eur_cents,
		   base_eur_cents, vat_eur_cents, vat_rate_ppm, country, credits_micro, wants_full_invoice, simulated,
		   withdrawal_acceptance_id, refunded_eur_cents, created_at, completed_at, updated_at)
		 VALUES (?, ?, ?, ?, 'stripe', ?, 'completed', 1000, 826, 174, 210000, 'ES', 10000000000, 0, 0, ?, 0, ?, ?, ?)`
	).run(
		input.id,
		BUYER,
		input.packId,
		`att_${input.id}`,
		input.providerRef,
		waiver,
		input.createdAt,
		input.createdAt,
		input.createdAt
	);
}

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(BUYER, 'comprador.a01@ejemplo.es', 'comprador.a01@ejemplo.es', Date.now(), Date.now());
		const pack = db
			.prepare<[], { id: string }>('SELECT id FROM packs ORDER BY sort_order LIMIT 1')
			.get();
		if (pack === undefined) throw new Error('la base de la prueba no tiene paquetes sembrados');
		insertPayment(db, {
			id: PAY_DAY1,
			createdAt: DAY1_MADRID,
			providerRef: 'pi_a01_dia1',
			packId: pack.id
		});
		insertPayment(db, {
			id: PAY_DAY2,
			createdAt: DAY2_MADRID,
			providerRef: 'pi_a01_dia2',
			packId: pack.id
		});
	} finally {
		db.close();
	}
	admin = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_a01_admin',
		email: 'admin.a01.http@ejemplo.es',
		password: 'contraseña-a01-http-123'
	});
});

describe('A-01 · el periodo de la exportación contable es de días de Madrid (Historias 4.3, BE-FR-76)', () => {
	it('la venta de las 00:30 de Madrid del 1 de febrero sale en el periodo 2026-02-01..2026-02-01, y la del día 2 no', async () => {
		const result = await send(
			baseUrl,
			'/admin/facturacion/exportar?archivo=ventas&desde=2026-02-01&hasta=2026-02-01',
			{ host: admin.webHost, headers: { cookie: admin.cookie, accept: 'text/csv' } }
		);

		expect(result.status).toBe(200);
		// Hoy falla: el periodo empieza a las 00:00 UTC (01:00 de Madrid) y deja fuera la venta de las 00:30.
		expect(result.text).toContain('pi_a01_dia1');
		// Hoy falla: el periodo acaba a las 23:59:59 UTC (00:59:59 del día 2 en Madrid) y mete la venta del día 2.
		expect(result.text).not.toContain('pi_a01_dia2');
	});

	it('el resumen mensual de febrero cuenta la venta del 1 de febrero de Madrid', async () => {
		const result = await send(
			baseUrl,
			'/admin/facturacion/exportar?archivo=mensual&desde=2026-02-01&hasta=2026-02-28',
			{ host: admin.webHost, headers: { cookie: admin.cookie, accept: 'text/csv' } }
		);

		expect(result.status).toBe(200);
		// Las dos ventas son de febrero en Madrid: el mes debe tener 2 ventas. Hoy solo cuenta 1.
		const febrero = result.text.split(/\r?\n/).find((line) => line.startsWith('2026-02'));
		expect(febrero?.split(/[;,]/)[1]).toBe('2');
	});
});
