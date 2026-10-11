// Crítico 1 (T112; BE-FR-01, 02, 64 CA2): registro con origen `secretario`, el enlace del email en el _outbox_ de test,
// la verificación por POST desde su botón y la bienvenida con los pasos siguientes. El captcha lo resuelve el simulador de
// Turnstile del global setup; el alta va por la acción del formulario con su Origin, como la haría el navegador.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

const OUTBOX = '.outbox';
const PASSWORD = 'contraseña-larga-123';
const PROVISIONAL_LEGAL_VERSION = '2026-10-11';

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

/** Último email del _outbox_ dirigido a esa dirección que contenga un enlace de verificación. */
function verificationTokenFor(address: string): string {
	const files = readdirSync(OUTBOX)
		.filter((name) => name.endsWith('.json'))
		.sort();
	const mails = files.map((name): unknown => {
		const parsed: unknown = JSON.parse(readFileSync(join(OUTBOX, name), 'utf8'));
		return parsed;
	});
	const mine = mails
		.filter(isOutboxEmail)
		.filter((mail) => mail.to === address && mail.text.includes('/verificar?token='));
	const last = mine[mine.length - 1];
	const match = /token=([^\s&]+)/.exec(last?.text ?? '');
	if (match?.[1] === undefined) throw new Error(`no hay enlace de verificación para ${address}`);
	return decodeURIComponent(match[1]);
}

test('@critical registro, verificación y bienvenida con el enlace del email', async ({
	page,
	request,
	baseURL
}) => {
	const email = `persona.${String(Date.now())}@ejemplo.es`;
	const origin = new URL(baseURL ?? 'http://localhost:7390').origin;

	const registration = await request.post('/registro?/registrar', {
		headers: { origin },
		form: {
			email,
			password: PASSWORD,
			acceptTerms: 'on',
			acceptPrivacy: 'on',
			acceptAup: 'on',
			ageDeclaration: 'on',
			'cf-turnstile-response': 'token-del-simulador',
			app: 'secretario',
			versionTerms: PROVISIONAL_LEGAL_VERSION,
			versionPrivacy: PROVISIONAL_LEGAL_VERSION,
			versionAup: PROVISIONAL_LEGAL_VERSION
		}
	});
	expect(registration.status()).toBe(200);
	// La acción responde con su resultado: éxito y la dirección a la que se envió (la página no vuelve a mostrar la contraseña).
	expect(await registration.text()).toContain(email);
	expect(await registration.text()).not.toContain(PASSWORD);

	await page.goto(`/verificar?token=${encodeURIComponent(verificationTokenFor(email))}`);
	await page.getByRole('button', { name: 'Confirmar mi email' }).click();

	await expect(page).toHaveURL(/\/panel\/bienvenida$/);
	await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible();
	await expect(
		page.getByText('Inicia sesión con tu email en la app que quieras usar.')
	).toBeVisible();
});
