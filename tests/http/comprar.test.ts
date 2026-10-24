import Database from 'better-sqlite3';
// Ruta de compra W20 `/panel/comprar` contra el build (T246; BE-FR-25, BE-FR-74; 15.15): quién puede abrirla y qué pasa
// con el formulario sin JavaScript cuando falta la renuncia. La compra completa con el simulador de pago va en el E2E de
// compra (T247).
import { describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, loginAsUser, FORM_HEADERS } from './admin-session';
import { send, type HttpResult } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;
const COMPRAR = '/panel/comprar';

function get(path: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, path, {
		host: webHost,
		headers: { accept: 'text/html', ...(cookie === undefined ? {} : { cookie }) }
	});
}

function sentTo(result: HttpResult, fragment: string): boolean {
	return result.status === 303 && String(result.headers.location).includes(fragment);
}

describe('compra W20 (BE-FR-25, BE-FR-74)', () => {
	it('anónimo: la compra manda al login con el destino guardado', async () => {
		const result = await get(COMPRAR);

		expect(sentTo(result, '/login?redirectTo=%2Fpanel%2Fcomprar')).toBe(true);
	});

	it('usuario verificado: la página abre y lista los paquetes sembrados', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_usuario',
			email: 'usuario.comprar@ejemplo.es',
			password: 'contraseña-compra-usuario-123'
		});

		const result = await get(COMPRAR, session.cookie);

		expect(result.status).toBe(200);
		expect(result.text).toContain('Pack 5');
	});

	it('sin renuncia marcada: la acción no compra y devuelve el fallo del formulario', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_sin_renuncia',
			email: 'sin.renuncia.comprar@ejemplo.es',
			password: 'contraseña-compra-renuncia-123'
		});
		const body = [
			'packId=pck_seed_5eur',
			'intentId=5f0c8a4e-8d3b-4c1a-9e2f-7b6d5a4c3b2a',
			'waiverVersion=1'
		].join('&');

		const result = await send(baseUrl, `${COMPRAR}?/comprar`, {
			method: 'POST',
			host: webHost,
			headers: { ...FORM_HEADERS, origin: webOrigin, cookie: session.cookie, accept: 'text/html' },
			body
		});

		expect(result.status).toBe(400);
		expect(result.status).not.toBe(303);
	});
});

// Compra completa por HTTP (T246): la renuncia vigente se lee de la base de la prueba, como hace el formulario.
function currentWaiverVersion(): string {
	const db = new Database(databasePath, { readonly: true });
	try {
		const version = db
			.prepare(
				"SELECT version FROM legal_documents WHERE document = 'withdrawal_waiver' ORDER BY published_at DESC LIMIT 1"
			)
			.pluck()
			.get();
		if (typeof version !== 'string')
			throw new Error('no hay renuncia vigente en la base de la prueba');
		return version;
	} finally {
		db.close();
	}
}

function purchaseForm(packId: string, intentId: string): string {
	return [
		`packId=${encodeURIComponent(packId)}`,
		`intentId=${intentId}`,
		`waiverVersion=${encodeURIComponent(currentWaiverVersion())}`,
		'waiverAccepted=true'
	].join('&');
}

function submitPurchase(cookie: string, body: string): Promise<HttpResult> {
	return send(baseUrl, `${COMPRAR}?/comprar`, {
		method: 'POST',
		host: webHost,
		headers: { ...FORM_HEADERS, origin: webOrigin, cookie, accept: 'text/html' },
		body
	});
}

describe('compra completa por HTTP (BE-FR-25, BE-FR-26)', () => {
	it('compra válida: redirige a la compra; repetir el mismo intento la lleva a la existente, sin acreditar otra vez', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_valida',
			email: 'compra.valida@ejemplo.es',
			password: 'contraseña-compra-valida-123'
		});
		const intentId = '1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
		const body = purchaseForm('pck_seed_5eur', intentId);

		const first = await submitPurchase(session.cookie, body);
		const again = await submitPurchase(session.cookie, body);

		expect(first.status).toBe(303);
		expect(String(first.headers.location)).toMatch(/\/panel\/comprar\/[^?]+$/);
		expect(again.status).toBe(303);
		expect(String(again.headers.location)).toContain('estado=repetida');
	});

	it('paquete inexistente o inactivo: la acción falla y no compra', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_inactivo',
			email: 'compra.inactivo@ejemplo.es',
			password: 'contraseña-compra-inactivo-123'
		});

		const result = await submitPurchase(
			session.cookie,
			purchaseForm('pck_no_existe', '2e3d4c5b-6f70-4b8c-9dae-1f2a3b4c5d6e')
		);

		expect(result.status).toBe(409);
	});

	it('intento de compra con identificador no válido: falla en el formulario', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_intento',
			email: 'compra.intento@ejemplo.es',
			password: 'contraseña-compra-intento-123'
		});

		const result = await submitPurchase(
			session.cookie,
			purchaseForm('pck_seed_5eur', 'no-es-un-uuid')
		);

		expect(result.status).toBe(400);
	});

	it('tester: puede abrir la compra (matriz de roles de L10)', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_tester',
			email: 'tester.comprar@ejemplo.es',
			password: 'contraseña-compra-tester-123'
		});
		const db = new Database(databasePath);
		try {
			db.prepare("UPDATE user SET role = 'tester' WHERE id = ?").run('usr_comprar_tester');
		} finally {
			db.close();
		}

		const result = await get(COMPRAR, session.cookie);

		expect(result.status).toBe(200);
	});
	it('sin verificar: la compra manda a reenviar la verificación', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_comprar_sin_verificar',
			email: 'sin.verificar.comprar@ejemplo.es',
			password: 'contraseña-compra-sinverificar-123'
		});
		const db = new Database(databasePath);
		try {
			db.prepare('UPDATE user SET email_verified = 0 WHERE id = ?').run(
				'usr_comprar_sin_verificar'
			);
		} finally {
			db.close();
		}

		const result = await get(COMPRAR, session.cookie);

		expect(sentTo(result, '/verificar/reenviar')).toBe(true);
	});

	it('admin: puede abrir la compra (matriz de roles de L10)', async () => {
		const session = await loginAsAdmin(baseUrl, databasePath, {
			id: 'usr_comprar_admin',
			email: 'admin.comprar@ejemplo.es',
			password: 'contraseña-compra-admin-123'
		});

		const result = await get(COMPRAR, session.cookie);

		expect(result.status).toBe(200);
	});
});
