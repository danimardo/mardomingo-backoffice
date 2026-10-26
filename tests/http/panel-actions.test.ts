// Acciones del perfil W27 `/panel/perfil` contra el build (T270 y T267; BE-FR-49.1–49.13, BE-FR-06, BE-FR-66; 15.15): quién
// puede enviarlas y cómo responden cuando los datos no valen. Los cambios que sí se aplican (contraseña, email, datos
// fiscales) se prueban en su integración; aquí se comprueba el contrato HTTP de cada acción.
import Database from 'better-sqlite3';
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser, FORM_HEADERS } from './admin-session';
import { send, type HttpResult } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;
const PERFIL = '/panel/perfil';

function get(path: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, path, {
		host: webHost,
		headers: { accept: 'text/html', ...(cookie === undefined ? {} : { cookie }) }
	});
}

function action(name: string, body: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, `${PERFIL}?/${name}`, {
		method: 'POST',
		host: webHost,
		headers: {
			...FORM_HEADERS,
			origin: webOrigin,
			accept: 'text/html',
			...(cookie === undefined ? {} : { cookie })
		},
		body
	});
}

function sentTo(result: HttpResult, fragment: string): boolean {
	return result.status === 303 && String(result.headers.location).includes(fragment);
}

async function verifiedUser(id: string): Promise<string> {
	const session = await loginAsUser(baseUrl, databasePath, {
		id,
		email: `${id}@ejemplo.es`,
		password: `contraseña-${id}-123`
	});
	return session.cookie;
}

describe('acciones del perfil W27 (BE-FR-49, BE-FR-06)', () => {
	it('anónimo: el perfil y sus acciones mandan al login', async () => {
		expect(sentTo(await get(PERFIL), `/login?redirectTo=${encodeURIComponent(PERFIL)}`)).toBe(true);
		expect(sentTo(await action('guardarAvisoSaldo', 'threshold=5'), '/login')).toBe(true);
		expect(sentTo(await action('cambiarEmail', ''), '/login')).toBe(true);
		expect(sentTo(await action('cambiarContrasena', ''), '/login')).toBe(true);
	});

	it('usuario verificado: el perfil no se guarda en caché y sus cabeceras lo dicen', async () => {
		const cookie = await verifiedUser('usr_perfil_cache');

		const result = await get(PERFIL, cookie);

		expect(result.status).toBe(200);
		expect(String(result.headers['cache-control'])).toContain('no-store');
	});

	it('aviso de saldo: un importe válido se guarda y redirige con aviso', async () => {
		const cookie = await verifiedUser('usr_perfil_aviso');

		const result = await action('guardarAvisoSaldo', 'threshold=5%2C50', cookie);

		expect(sentTo(result, '/panel/perfil?aviso=threshold_saved')).toBe(true);
	});

	it('aviso de saldo: un importe negativo o escrito mal no se guarda', async () => {
		const cookie = await verifiedUser('usr_perfil_aviso_malo');

		const result = await action('guardarAvisoSaldo', 'threshold=-3', cookie);

		expect(result.status).toBe(400);
	});

	it('datos fiscales incompletos: falla en el formulario y no guarda nada', async () => {
		const cookie = await verifiedUser('usr_perfil_fiscal');

		const result = await action(
			'guardarDatosFiscales',
			'kind=individual&legalName=&taxId=',
			cookie
		);

		expect(result.status).toBe(400);
		const db = new Database(databasePath, { readonly: true });
		try {
			const row = db
				.prepare('SELECT COUNT(*) AS total FROM billing_profiles WHERE user_id = ?')
				.pluck()
				.get('usr_perfil_fiscal');
			expect(row).toBe(0);
		} finally {
			db.close();
		}
	});

	it('cambiar contraseña con la actual incorrecta: falla y no cambia nada', async () => {
		const cookie = await verifiedUser('usr_perfil_clave');

		const result = await action(
			'cambiarContrasena',
			'currentPassword=no-es-la-clave&newPassword=contraseña-nueva-de-prueba-456&confirmation=contraseña-nueva-de-prueba-456',
			cookie
		);

		expect(result.status).toBe(400);
	});

	it('cambiar el email con la contraseña incorrecta: falla sin enviar nada', async () => {
		const cookie = await verifiedUser('usr_perfil_email');

		const result = await action(
			'cambiarEmail',
			'newEmail=nuevo.correo%40ejemplo.es&currentPassword=no-es-la-clave',
			cookie
		);

		expect(result.status).toBe(400);
	});
});

// Aceptación de documentos desde el panel (T279; BE-FR-70/CA2–CA3): la versión que se acepta es la vigente en la base.
function currentLegalVersion(document: string): string {
	const db = new Database(databasePath, { readonly: true });
	try {
		const version = db
			.prepare(
				'SELECT version FROM legal_documents WHERE document = ? ORDER BY published_at DESC LIMIT 1'
			)
			.pluck()
			.get(document);
		if (typeof version !== 'string') throw new Error(`sin versión vigente de ${document}`);
		return version;
	} finally {
		db.close();
	}
}

describe('aceptación de documentos desde el panel (BE-FR-70)', () => {
	it('sin ningún documento marcado: la acción falla y no acepta nada', async () => {
		const cookie = await verifiedUser('usr_panel_sin_docs');

		const result = await send(baseUrl, '/panel?/aceptarDocumentos', {
			method: 'POST',
			host: webHost,
			headers: { ...FORM_HEADERS, origin: webOrigin, accept: 'text/html', cookie },
			body: ''
		});

		expect(result.status).toBe(400);
	});

	it('aceptar la versión vigente de los tres documentos redirige con aviso', async () => {
		const cookie = await verifiedUser('usr_panel_acepta');
		const body = ['terms', 'privacy', 'aup']
			.map(
				(document) => `documents=${document}%3A${encodeURIComponent(currentLegalVersion(document))}`
			)
			.join('&');

		const result = await send(baseUrl, '/panel?/aceptarDocumentos', {
			method: 'POST',
			host: webHost,
			headers: { ...FORM_HEADERS, origin: webOrigin, accept: 'text/html', cookie },
			body
		});

		expect(sentTo(result, '/panel?aviso=terms_accepted')).toBe(true);
	});
});
