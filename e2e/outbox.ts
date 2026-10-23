// Ayudas de los E2E de cuentas (T112): registro y verificación por HTTP como lo haría el navegador, y lectura de los
// enlaces de los emails en el _outbox_ del entorno de pruebas (el servidor escribe ahí en vez de enviar).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures';

const OUTBOX = '.outbox';
export const PASSWORD = 'contraseña-larga-123';
const LEGAL_VERSION = '2026-10-11';

interface OutboxEmail {
	readonly to: string;
	readonly text: string;
}

function isOutboxEmail(value: unknown): value is OutboxEmail {
	return (
		typeof value === 'object' &&
		value !== null &&
		'to' in value &&
		typeof value.to === 'string' &&
		'text' in value &&
		typeof value.text === 'string'
	);
}

/** Espera síncrona de `ms` milisegundos (los helpers son síncronos y los llaman muchos specs). */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Token del último email dirigido a esa dirección cuyo texto contiene `marker`, o `undefined` si aún no está. */
function findToken(address: string, marker: string): string | undefined {
	const files = readdirSync(OUTBOX)
		.filter((name) => name.endsWith('.json'))
		.sort();
	const mails = files.map((name): unknown => {
		const parsed: unknown = JSON.parse(readFileSync(join(OUTBOX, name), 'utf8'));
		return parsed;
	});
	const mine = mails
		.filter(isOutboxEmail)
		.filter((mail) => mail.to === address && mail.text.includes(marker));
	const last = mine[mine.length - 1];
	const match = /token=([^\s&]+)/.exec(last?.text ?? '');
	return match?.[1] === undefined ? undefined : decodeURIComponent(match[1]);
}

/**
 * Token del último email de esa dirección. El servidor escribe el email de forma asíncrona, después de responder al
 * registro: con carga, la lectura inmediata llega antes que el fichero (T288, flakiness de la pasada completa). Por eso
 * reintenta durante hasta 10 s antes de fallar.
 */
function tokenInLatestMail(address: string, marker: string): string {
	const deadline = Date.now() + 10_000;
	for (;;) {
		const token = findToken(address, marker);
		if (token !== undefined) return token;
		if (Date.now() >= deadline) throw new Error(`no hay enlace (${marker}) para ${address}`);
		sleepSync(100);
	}
}

export function verificationTokenFor(address: string): string {
	return tokenInLatestMail(address, '/verificar?token=');
}

export function resetTokenFor(address: string): string {
	return tokenInLatestMail(address, '/recuperar/nueva?token=');
}

/**
 * Dirección única para una cuenta de prueba. El servidor de pruebas admite tres altas por IP en 24 h, así que cada
 * prueba que crea una cuenta debe compartirla con otras o pedir una sola.
 */
export function uniqueEmail(prefix: string): string {
	return `${prefix}.${String(Date.now())}.${randomUUID().slice(0, 8)}@ejemplo.es`;
}

/** Dirección única de gmail: el buzón de la forma normalizada del saldo de bienvenida (BE-FR-11.5). */
export function uniqueGmail(prefix: string): string {
	return `${prefix}.${String(Date.now())}.${randomUUID().slice(0, 8)}@gmail.com`;
}

/**
 * Versiones vigentes de los documentos, tal como las lleva el formulario de registro en campos ocultos. Otras pruebas
 * publican versiones nuevas en la misma base; por eso el alta usa las vigentes del momento y no una fija (T288).
 */
async function currentRegisterVersions(
	request: APIRequestContext
): Promise<Record<string, string>> {
	const html = await (await request.get('/registro')).text();
	const versions: Record<string, string> = {};
	for (const name of ['versionTerms', 'versionPrivacy', 'versionAup']) {
		const match = new RegExp(`name="${name}" value="([^"]*)"`).exec(html);
		versions[name] = match?.[1] ?? LEGAL_VERSION;
	}
	return versions;
}

/**
 * Alta por el formulario de registro (acción `registrar`), con el captcha del simulador y el origen propio. Si el
 * servidor rechaza el alta porque la versión cambió justo antes (`legal_version_changed`), la página no muestra la
 * dirección: se vuelve a leer la versión vigente y se reintenta, hasta tres veces.
 */
export async function registerThroughForm(
	request: APIRequestContext,
	baseURL: string,
	email: string
): Promise<void> {
	await registerAttempt(request, baseURL, email);
}

/** Como `registerThroughForm`, pero devuelve el HTML de la respuesta (la prueba de verificación lo inspecciona). */
export async function registerAttempt(
	request: APIRequestContext,
	baseURL: string,
	email: string
): Promise<string> {
	let lastBody = '';
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		const versions = await currentRegisterVersions(request);
		const response = await request.post('/registro?/registrar', {
			headers: { origin: new URL(baseURL).origin },
			form: {
				email,
				password: PASSWORD,
				acceptTerms: 'on',
				acceptPrivacy: 'on',
				acceptAup: 'on',
				ageDeclaration: 'on',
				'cf-turnstile-response': 'token-del-simulador',
				app: 'secretario',
				versionTerms: versions.versionTerms ?? LEGAL_VERSION,
				versionPrivacy: versions.versionPrivacy ?? LEGAL_VERSION,
				versionAup: versions.versionAup ?? LEGAL_VERSION
			}
		});
		expect(response.status()).toBe(200);
		const body = await response.text();
		lastBody = body;
		// El fallo también repite la dirección en el formulario: el éxito se reconoce por su resultado, no por el email.
		if (/"type":"success"|"success":true/.test(body)) return body;
	}
	throw new Error(
		`el registro de ${email} no se aceptó tras tres intentos: ${lastBody.slice(0, 400)}`
	);
}

/** Verificación por la acción del botón de `/verificar`, con el token del email. */
export async function verifyThroughForm(
	request: APIRequestContext,
	baseURL: string,
	token: string
): Promise<void> {
	const response = await request.post('/verificar?/verificar', {
		headers: { origin: new URL(baseURL).origin },
		form: { token }
	});
	expect(response.ok()).toBe(true);
}
