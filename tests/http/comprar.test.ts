// Ruta de compra W20 `/panel/comprar` contra el build (T246; BE-FR-25, BE-FR-74; 15.15): quién puede abrirla y qué pasa
// con el formulario sin JavaScript cuando falta la renuncia. La compra completa con el simulador de pago va en el E2E de
// compra (T247).
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser, FORM_HEADERS } from './admin-session';
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
			'waiverVersion=1',
			'wantsFullInvoice=false'
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
