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

/** Token del último email dirigido a esa dirección cuyo texto contiene `marker`. */
function tokenInLatestMail(address: string, marker: string): string {
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
	if (match?.[1] === undefined) throw new Error(`no hay enlace (${marker}) para ${address}`);
	return decodeURIComponent(match[1]);
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

/** Alta por el formulario de registro (acción `registrar`), con el captcha del simulador y el origen propio. */
export async function registerThroughForm(
	request: APIRequestContext,
	baseURL: string,
	email: string
): Promise<void> {
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
			versionTerms: LEGAL_VERSION,
			versionPrivacy: LEGAL_VERSION,
			versionAup: LEGAL_VERSION
		}
	});
	expect(response.status()).toBe(200);
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
