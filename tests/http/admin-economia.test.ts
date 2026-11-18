// W38 · parámetros económicos contra el build con sesión de administrador (BE-FR-61, BE-FR-55; T309): un valor incoherente se
// rechaza, un cambio sin confirmación no se aplica, y un cambio confirmado se aplica, se muestra y queda auditado. El valor se
// restaura al terminar para no alterar a otras pruebas de la misma base.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const KEY = 'min_balance_to_operate';
const DEFAULT_VALUE = '5000000';
const CHANGED_VALUE = '6000000';
const ACTION = '/admin/economia?/guardarParametros';

let session: AdminSession;

function auditCount(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit WHERE action = ?')
			.get('apps.setting.update');
		return row?.n ?? 0;
	} finally {
		db.close();
	}
}

async function pageHtml(): Promise<string> {
	const result = await send(baseUrl, '/admin/economia', {
		host: session.webHost,
		headers: { accept: 'text/html', cookie: session.cookie }
	});
	return result.text;
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_economia_admin',
		email: 'admin.economia.http@ejemplo.es',
		password: 'contraseña-economia-http-123'
	});
});

afterAll(async () => {
	// Vuelve al valor por defecto para no alterar otras pruebas de la base.
	await postAdmin(
		session,
		ACTION,
		`clave=${KEY}&valor=${DEFAULT_VALUE}&motivo=Restaurar+valor+de+prueba&confirmado=true`
	);
});

describe('parámetros económicos con sesión de administrador (W38, T309)', () => {
	it('la página muestra el valor vigente, el valor por defecto y el origen global', async () => {
		const html = await pageHtml();

		expect(html).toContain('Valor por defecto');
		expect(html).toContain('alcance global');
		expect(html).toContain(`name="valor"`);
	});

	it('un valor incoherente (margen o saldo mínimo fuera de rango) responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const negativo = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=-1&motivo=Valor+incoherente&confirmado=true`
		);

		expect(negativo.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio sin confirmación responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const sinConfirmar = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Sin+confirmar`
		);

		expect(sinConfirmar.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio confirmado se aplica, se muestra en la página y queda auditado', async () => {
		const antes = auditCount();

		const aplicado = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Subida+de+saldo+minimo&confirmado=true`
		);

		expect(aplicado.status).toBe(303);
		expect(auditCount()).toBe(antes + 1);
		expect(await pageHtml()).toContain(`value="${CHANGED_VALUE}"`);
	});
});

// C-48 (T439; BE-FR-61 CA2, BE-FR-87 CA3): el tipo manual es un entero entre 500.000 y 2.000.000 ppm. Un valor fuera de rango o
// que no es un entero responde 400 con el error en el campo (antes, 920 se guardaba y «0.92» daba 500), y la vista previa
// muestra el tipo vigente y el nuevo sin escribir nada.
describe('tipo de cambio manual con rango (W38, C-48)', () => {
	const FX_ACTION = '/admin/economia?/fijarTipoCambioManual';

	function manualFxRows(): number {
		const db = new Database(databasePath, { readonly: true });
		try {
			const row = db
				.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM fx_rates WHERE source = 'manual'")
				.get();
			return row?.n ?? 0;
		} finally {
			db.close();
		}
	}

	it.each([
		['fuera de rango por abajo', '920'],
		['fuera de rango por arriba', '50000000'],
		['decimal', '0.92'],
		['vacío', '']
	])('%s responde 400 con el error en el campo y no fija nada', async (_name, value) => {
		const antes = manualFxRows();

		const result = await postAdmin(
			session,
			FX_ACTION,
			`usdEurPpm=${encodeURIComponent(value)}&motivo=Error+de+tecleo&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(result.text).toContain('Escribe un número entero entre 500000 y 2000000 ppm');
		expect(manualFxRows()).toBe(antes);
	});

	it('la vista previa muestra el tipo vigente y el nuevo, y no fija nada', async () => {
		const antes = manualFxRows();

		const result = await postAdmin(
			session,
			'/admin/economia?/previsualizarTipoCambioManual',
			'usdEurPpm=1000000&motivo=Tipo+de+la+gestor%C3%ADa'
		);

		expect(result.status).toBe(200);
		expect(result.text).toContain('Vista previa del tipo de cambio');
		expect(result.text).toMatch(/\d+ ppm \([\d,]+ EUR por USD\) → 1000000 ppm \(1 EUR por USD\)/);
		expect(manualFxRows()).toBe(antes);
	});
});

// C-58 (T449; BE-FR-73, BE-FR-55): fijar el precio orientativo de una operación que no existe, con un motivo válido, responde 404
// `NOT_FOUND` como las demás acciones de administración sobre una entidad inexistente, sin escribir ni auditar (antes, la clave
// foránea de `price_references` lo rechazaba dentro de la transacción y respondía 500).
describe('precio orientativo de una operación inexistente (W38, C-58)', () => {
	function rowsOf(sql: string): number {
		const db = new Database(databasePath, { readonly: true });
		try {
			return db.prepare<[], { n: number }>(sql).get()?.n ?? 0;
		} finally {
			db.close();
		}
	}

	it('responde 404 y no escribe ni audita', async () => {
		const audits = "SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'pricing.price.manual'";
		const references =
			"SELECT COUNT(*) AS n FROM price_references WHERE operation_id = 'aop_c58_inexistente'";
		const antes = rowsOf(audits);

		const result = await postAdmin(
			session,
			'/admin/economia?/guardarPrecioOrientativo',
			'operacion=aop_c58_inexistente&microUsd=5&motivo=Precio+acordado&confirmado=true'
		);

		expect(result.status).toBe(404);
		expect(rowsOf(audits)).toBe(antes);
		expect(rowsOf(references)).toBe(0);
	});
});
