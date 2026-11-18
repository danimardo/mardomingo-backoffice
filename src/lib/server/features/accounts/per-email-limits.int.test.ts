// Límite por email del reenvío de la verificación y de la recuperación (C-34; BE-FR-45, BE-FR-02 CA3, contracts/api-v1 E03):
// con varias IP, o con un /64, no se puede inundar el buzón de una cuenta. Al superar el límite no se envía nada ni se crea
// ningún enlace, y la respuesta y su tiempo son los de siempre (C-17).
import { like } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	accountsFixture,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { verification } from './schema';

/** `resend_verification_per_email_hour` y `password_reset_per_email_hour` sembrados (apps/defaults.ts). */
const PER_EMAIL_HOUR = 3;
const ATTEMPTS = 10;
const MAX_DIFFERENCE_MS = 50;

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

/** Una IP distinta en cada intento: el límite por IP no llega a saltar. */
function ipNumber(index: number): string {
	return `198.51.100.${String(index + 10)}`;
}

function verificationEmailsTo(address: string): number {
	return fixture.mail.sent.filter(
		(item) => item.to === address && item.text.includes('/verificar?token=')
	).length;
}

function resetLinks(): number {
	return fixture.database.db
		.select()
		.from(verification)
		.where(like(verification.identifier, 'reset-password:%'))
		.all().length;
}

async function elapsed(action: () => Promise<unknown>): Promise<number> {
	const start = performance.now();
	await action();
	return performance.now() - start;
}

async function verifiedAccount(): Promise<void> {
	await fixture.accounts.register(registration());
	await fixture.accounts.drainEmails();
	await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, EMAIL));
}

describe('[C-34] límite por email del reenvío y la recuperación', () => {
	it('reenviar la verificación desde muchas IP envía como mucho el límite a la misma dirección, sin error', async () => {
		await fixture.accounts.register(registration());
		await fixture.accounts.drainEmails();
		const before = verificationEmailsTo(EMAIL);

		for (let index = 0; index < ATTEMPTS; index += 1) {
			// La respuesta sigue siendo neutra: no lanza ni revela nada; solo cambia que no se envía.
			await fixture.accounts.resendVerification({ email: EMAIL, remoteIp: ipNumber(index) });
		}
		await fixture.accounts.drainEmails();

		expect(verificationEmailsTo(EMAIL) - before).toBe(PER_EMAIL_HOUR);
	}, 30_000);

	it('pedir la recuperación desde muchas IP crea como mucho el límite de enlaces, sin error', async () => {
		await verifiedAccount();

		for (let index = 0; index < ATTEMPTS; index += 1) {
			await fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: ipNumber(index) });
		}
		await fixture.accounts.drainEmails();

		expect(resetLinks()).toBe(PER_EMAIL_HOUR);
	}, 30_000);

	it('el email se normaliza: las mayúsculas cuentan como la misma dirección, también sin IP', async () => {
		await verifiedAccount();
		const variants = [EMAIL, 'JUAN@ejemplo.es', 'Juan@Ejemplo.ES', EMAIL, 'juan@EJEMPLO.es'];

		for (const email of variants) {
			await fixture.accounts.requestPasswordReset({ email, remoteIp: null });
		}

		expect(resetLinks()).toBe(PER_EMAIL_HOUR);
	}, 30_000);

	it('el reenvío que supera el límite tarda lo mismo que uno que se envía (C-17)', async () => {
		await fixture.accounts.register(registration());
		await fixture.accounts.drainEmails();
		for (let index = 0; index < PER_EMAIL_HOUR - 1; index += 1) {
			await fixture.accounts.resendVerification({ email: EMAIL, remoteIp: ipNumber(index) });
		}

		const sent = await elapsed(() =>
			fixture.accounts.resendVerification({ email: EMAIL, remoteIp: ipNumber(PER_EMAIL_HOUR) })
		);
		const suppressed = await elapsed(() =>
			fixture.accounts.resendVerification({ email: EMAIL, remoteIp: ipNumber(PER_EMAIL_HOUR + 1) })
		);

		expect(Math.abs(sent - suppressed)).toBeLessThan(MAX_DIFFERENCE_MS);
	}, 30_000);

	it('el límite de una dirección no afecta a otra', async () => {
		await verifiedAccount();
		await fixture.accounts.register(registration({ email: 'ana@ejemplo.es', remoteIp: null }));
		await fixture.accounts.drainEmails();
		await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, 'ana@ejemplo.es'));

		for (let index = 0; index < PER_EMAIL_HOUR + 1; index += 1) {
			await fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: null });
		}
		await fixture.accounts.requestPasswordReset({ email: 'ana@ejemplo.es', remoteIp: null });

		expect(resetLinks()).toBe(PER_EMAIL_HOUR + 1);
	}, 30_000);
});
