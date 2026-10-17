// Cambio de email de la cuenta (W27 y W14; BE-FR-66, BE-FR-45; T266). Dos pasos: pedir (contraseña actual, límite por IP y un
// enlace de 24 h a la dirección NUEVA) y confirmar (el enlace aplica el cambio, cierra todas las sesiones y avisa a la dirección
// ANTERIOR). No hay bienvenida nueva: el alta ya se concedió. Una dirección de otra cuenta responde igual que una libre, sin email.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { immediateTransaction } from '$lib/server/db/tx';
import { sendAccountEmail } from '$lib/server/features/notifications';
import { normalizeEmail } from './domain/email';
import { account, session, user, verification } from './schema';
import { ipRateLimited, type AccountsDeps } from './service';

export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
/** Peticiones de cambio de email por IP y hora (BE-FR-45). */
export const EMAIL_CHANGE_PER_IP_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const IDENTIFIER_PREFIX = 'email-change:';

interface ChangePayload {
	readonly userId: string;
	readonly newEmail: string;
	readonly normalized: string;
}

export type EmailChangeRequestOutcome = 'sent' | 'wrong_password';
export type EmailChangeConfirmOutcome =
	| { readonly outcome: 'applied'; readonly sessionsClosed: number }
	| { readonly outcome: 'expired' | 'invalid' | 'taken' };

function sha256Hex(text: string): string {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

function payloadOf(raw: string): ChangePayload | null {
	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== 'object' || parsed === null) return null;
	if (!('userId' in parsed) || !('newEmail' in parsed) || !('normalized' in parsed)) return null;
	const { userId, newEmail, normalized } = parsed;
	if (
		typeof userId !== 'string' ||
		typeof newEmail !== 'string' ||
		typeof normalized !== 'string'
	) {
		return null;
	}
	return { userId, newEmail, normalized };
}

/** Pide el cambio: comprueba la contraseña, el límite por IP y envía el enlace a la dirección nueva. */
export async function requestEmailChange(
	deps: AccountsDeps,
	input: {
		readonly userId: string;
		readonly currentPassword: string;
		readonly newEmail: string;
		readonly remoteIp: string | null;
		readonly publicWebUrl: string;
	}
): Promise<EmailChangeRequestOutcome> {
	const now = deps.clock.now();
	if (input.remoteIp !== null) {
		ipRateLimited(deps, 'email_change', input.remoteIp, now, HOUR_MS, EMAIL_CHANGE_PER_IP_HOUR);
	}

	const rows = deps.db
		.select({ email: user.email, password: account.password })
		.from(user)
		.innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
		.where(eq(user.id, input.userId))
		.all();
	const current = rows.at(0);
	const currentEmail: string | undefined = current?.email;
	const passwordHash: string | null | undefined = current?.password;
	const valid =
		passwordHash != null &&
		(await verifyPassword({ hash: passwordHash, password: input.currentPassword }));
	if (!valid) {
		deps.logger.emit('accounts.email_change.rejected', { reason: 'wrong_password' });
		return 'wrong_password';
	}

	const newNormalized = normalizeEmail(input.newEmail);
	const taken = deps.db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.emailNormalized, newNormalized), ne(user.id, input.userId)))
		.get();
	// Igual que una dirección libre: la respuesta no revela si la dirección pertenece a otra cuenta (CA3).
	if (taken !== undefined || newNormalized === normalizeEmail(currentEmail ?? '')) {
		deps.logger.emit('accounts.email_change.requested', { status: 'suppressed' });
		return 'sent';
	}

	const token = randomBytes(32).toString('base64url');
	const payload: ChangePayload = {
		userId: input.userId,
		newEmail: input.newEmail.trim().toLowerCase(),
		normalized: newNormalized
	};
	deps.db
		.insert(verification)
		.values({
			id: randomBytes(16).toString('hex'),
			identifier: `${IDENTIFIER_PREFIX}${sha256Hex(token)}`,
			value: JSON.stringify(payload),
			expiresAt: new Date(now + EMAIL_CHANGE_TTL_MS),
			createdAt: new Date(now),
			updatedAt: new Date(now)
		})
		.run();

	await sendAccountEmail(deps.notifications, {
		reason: 'email_change_verify',
		to: payload.newEmail,
		link: `${input.publicWebUrl}/email/confirmar?token=${encodeURIComponent(token)}`,
		idempotencyKey: `email-change-${sha256Hex(token)}`
	});
	deps.logger.emit('accounts.email_change.requested', { status: 'sent' });
	return 'sent';
}

/** Aplica el cambio desde el enlace: un solo uso, 24 h, cierra todas las sesiones y avisa a la dirección anterior. */
export async function confirmEmailChange(
	deps: AccountsDeps,
	token: string
): Promise<EmailChangeConfirmOutcome> {
	const now = deps.clock.now();
	const identifier = `${IDENTIFIER_PREFIX}${sha256Hex(token)}`;
	const row = deps.db
		.select()
		.from(verification)
		.where(eq(verification.identifier, identifier))
		.get();
	if (row === undefined) {
		deps.logger.emit('accounts.email_change.rejected', { reason: 'invalid' });
		return { outcome: 'invalid' };
	}
	const payload = payloadOf(row.value);
	if (payload === null) return { outcome: 'invalid' };
	if (row.expiresAt.getTime() < now) {
		deps.db.delete(verification).where(eq(verification.identifier, identifier)).run();
		deps.logger.emit('accounts.email_change.rejected', { reason: 'expired' });
		return { outcome: 'expired' };
	}

	const result = immediateTransaction(deps.db, (tx) => {
		const still = tx
			.select({ id: verification.id })
			.from(verification)
			.where(eq(verification.identifier, identifier))
			.get();
		if (still === undefined) return { outcome: 'invalid' as const };

		const taken = tx
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.emailNormalized, payload.normalized), ne(user.id, payload.userId)))
			.get();
		if (taken !== undefined) return { outcome: 'taken' as const };

		const owner = tx
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, payload.userId))
			.get();
		if (owner === undefined) return { outcome: 'invalid' as const };

		tx.update(user)
			.set({ email: payload.newEmail, emailNormalized: payload.normalized })
			.where(eq(user.id, payload.userId))
			.run();
		tx.delete(verification).where(eq(verification.identifier, identifier)).run();
		const closed = tx.delete(session).where(eq(session.userId, payload.userId)).run();
		return {
			outcome: 'applied' as const,
			previousEmail: owner.email,
			sessionsClosed: closed.changes
		};
	});

	if (result.outcome !== 'applied') {
		deps.logger.emit('accounts.email_change.rejected', { reason: result.outcome });
		return { outcome: result.outcome };
	}
	await sendAccountEmail(deps.notifications, {
		reason: 'email_changed_notice',
		to: result.previousEmail,
		idempotencyKey: `email-changed-${sha256Hex(token)}`
	});
	deps.logger.emit('accounts.email_change.applied', { sessionsClosed: result.sessionsClosed });
	return { outcome: 'applied', sessionsClosed: result.sessionsClosed };
}
