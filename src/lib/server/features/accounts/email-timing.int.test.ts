// Envío de emails sin esperar (C-17; BE-FR-01 CA5): con un proveedor lento, el tiempo de respuesta no distingue una cuenta
// existente de una inexistente (registro, reenvío de verificación, recuperación) ni, en el cambio de email, una dirección
// libre de una ocupada. Los envíos acaban llegando: el test los espera con `drainEmails()`.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EmailSender, OutgoingEmail } from '$lib/server/adapters/resend/email-sender';
import { createAccounts, type Accounts } from '$lib/server/features/accounts';
import {
	accountsFixture,
	EMAIL,
	PASSWORD,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { user } from './schema';

const SEND_DELAY_MS = 300;
const MAX_DIFFERENCE_MS = 50;
let f: AccountsFixture;
let slow: Accounts;
let userId: string;

/** Proveedor que tarda en responder; delega en el buzón de prueba al terminar. */
function slowSender(inner: EmailSender): EmailSender {
	return {
		send: async (email: OutgoingEmail) => {
			await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
			return inner.send(email);
		}
	};
}

async function elapsed(action: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await action();
	return performance.now() - start;
}

beforeEach(async () => {
	f = accountsFixture();
	await f.accounts.register(registration());
	await f.accounts.verifyEmail(verificationTokenFor(f.mail, EMAIL));
	const row = f.database.db.select({ id: user.id }).from(user).where(eq(user.email, EMAIL)).get();
	if (row === undefined) throw new Error('la cuenta debía existir');
	userId = row.id;
	await f.accounts.drainEmails();
	slow = createAccounts({
		...f.config,
		notifications: { ...f.config.notifications, sender: slowSender(f.mail) }
	});
});

afterEach(async () => {
	await slow.drainEmails();
	f.close();
});

describe('envío de emails sin esperar (C-17)', () => {
	it('[BE-FR-01/CA5] la recuperación tarda igual con cuenta que sin ella, y el email llega al drenar', async () => {
		await slow.requestPasswordReset({ email: 'nadie@ejemplo.es', remoteIp: null }); // calienta
		const missing = await elapsed(() =>
			slow.requestPasswordReset({ email: 'otro@ejemplo.es', remoteIp: null })
		);
		const existing = await elapsed(() =>
			slow.requestPasswordReset({ email: EMAIL, remoteIp: null })
		);
		expect(Math.abs(existing - missing)).toBeLessThan(MAX_DIFFERENCE_MS);

		const before = f.mail.sent.length;
		await slow.drainEmails();
		expect(f.mail.sent.length).toBe(before + 1);
		expect(f.mail.sent.at(-1)?.to).toBe(EMAIL);
	});

	it('[BE-FR-01/CA5] el reenvío de verificación tarda igual con cuenta pendiente que sin ella', async () => {
		await slow.register(registration({ email: 'pendiente@ejemplo.es', remoteIp: null }));
		await slow.drainEmails();
		await slow.resendVerification({ email: 'nadie@ejemplo.es', remoteIp: null }); // calienta
		const missing = await elapsed(() =>
			slow.resendVerification({ email: 'otro@ejemplo.es', remoteIp: null })
		);
		const before = f.mail.sent.length;
		const pending = await elapsed(() =>
			slow.resendVerification({ email: 'pendiente@ejemplo.es', remoteIp: null })
		);
		expect(Math.abs(pending - missing)).toBeLessThan(MAX_DIFFERENCE_MS);

		await slow.drainEmails();
		expect(f.mail.sent.length).toBe(before + 1);
	});

	it('[BE-FR-01/CA5] el registro tarda igual con un email nuevo que con uno ya registrado', async () => {
		await slow.register(registration({ email: 'calienta@ejemplo.es', remoteIp: null }));
		// El alta real hace más trabajo local que el rechazo: se compara el mejor de tres para que la contención de la máquina
		// (otros tests en paralelo) no decida el resultado.
		const samples = 3;
		const existing: number[] = [];
		const fresh: number[] = [];
		for (let index = 0; index < samples; index += 1) {
			existing.push(await elapsed(() => slow.register(registration({ remoteIp: null }))));
			fresh.push(
				await elapsed(() =>
					slow.register(registration({ email: `nuevo${String(index)}@ejemplo.es`, remoteIp: null }))
				)
			);
		}
		expect(Math.abs(Math.min(...fresh) - Math.min(...existing))).toBeLessThan(MAX_DIFFERENCE_MS);
		await slow.drainEmails();
		expect(f.mail.sent.some((item) => item.to === 'nuevo0@ejemplo.es')).toBe(true);
	});

	it('[BE-FR-66/CA3] el cambio de email tarda igual con una dirección libre que con una ocupada', async () => {
		await f.accounts.register(registration({ email: 'ocupada@ejemplo.es', remoteIp: null }));
		await f.accounts.drainEmails();
		const request = (newEmail: string) =>
			slow.requestEmailChange({
				userId,
				currentPassword: PASSWORD,
				newEmail,
				remoteIp: null
			});
		const taken = await elapsed(() => request('ocupada@ejemplo.es'));
		const free = await elapsed(() => request('libre@ejemplo.es'));
		expect(Math.abs(free - taken)).toBeLessThan(MAX_DIFFERENCE_MS);

		const before = f.mail.sent.length;
		await slow.drainEmails();
		expect(f.mail.sent.length).toBe(before + 2); // aviso a la dirección actual y enlace a la nueva
		expect(f.mail.sent.some((item) => item.to === 'libre@ejemplo.es')).toBe(true);
	});
});
