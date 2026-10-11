// Alertas al administrador (Historias 5.13; SC-019; T151). Persiste el estado en `alerts_state` y envía el aviso solo al
// cruzar la condición. Un envío fallido deja la alerta inactiva, para que el siguiente cruce lo reintente y no se pierda.
import { eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { EmailSender } from '$lib/server/adapters/resend/email-sender';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import { toEpochMs } from '$lib/shared/time';
import { decideClear, decideRaise, type AlertKey, type AlertRecord } from './domain/alert-state';
import { adminAlertEmail } from './emails/admin-alert';
import type { AlertType } from './events';
import { alertsState } from './schema';

export interface AlertDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly sender: EmailSender;
	/** Destinatario del aviso: `ADMIN_EMAIL`. Sin él, el estado se guarda pero no sale el email. */
	readonly adminEmail: () => string | null;
	readonly supportEmail: () => string;
}

/** Tipo de la alerta a partir de su clave (sin datos de usuario). */
export function alertTypeOf(key: AlertKey): AlertType {
	if (key === 'fx_stale') return 'fx_stale';
	if (key.startsWith('flagged:')) return 'flagged_threshold';
	return key.endsWith(':retired') ? 'model_retired' : 'model_price';
}

function readRecord(tx: Tx, key: AlertKey): AlertRecord | undefined {
	const row = tx.select().from(alertsState).where(eqKey(key)).get();
	return row === undefined ? undefined : { active: row.active, lastSentAt: row.lastSentAt };
}

function writeRecord(tx: Tx, key: AlertKey, record: AlertRecord, now: number): void {
	const lastSentAt = record.lastSentAt === null ? null : toEpochMs(record.lastSentAt);
	tx.insert(alertsState)
		.values({ key, active: record.active, lastSentAt, updatedAt: toEpochMs(now) })
		.onConflictDoUpdate({
			target: alertsState.key,
			set: { active: record.active, lastSentAt, updatedAt: toEpochMs(now) }
		})
		.run();
}

function eqKey(key: AlertKey) {
	return eq(alertsState.key, key);
}

/**
 * La condición de la alerta se cumple. Envía el aviso solo si no estaba activa; si ya lo estaba, no repite nada.
 * Devuelve `sent` o `suppressed`.
 */
export async function raiseAlert(
	deps: AlertDeps,
	input: { readonly key: AlertKey; readonly detail: string }
): Promise<'sent' | 'suppressed'> {
	const now = deps.clock.now();
	const type = alertTypeOf(input.key);
	const decision = immediateTransaction(deps.db, (tx) => {
		const decided = decideRaise(readRecord(tx, input.key), now);
		writeRecord(tx, input.key, decided.next, now);
		return decided;
	});
	if (decision.action === 'suppress') {
		deps.logger.emit('notifications.alert.suppressed', { type });
		return 'suppressed';
	}
	deps.logger.emit('notifications.alert.triggered', { type });

	const to = deps.adminEmail();
	if (to === null) return 'sent';
	const content = adminAlertEmail({
		kind: type,
		detail: input.detail,
		supportEmail: deps.supportEmail()
	});
	const result = await deps.sender.send({
		to,
		subject: content.subject,
		text: content.text,
		html: content.html,
		replyTo: deps.supportEmail(),
		idempotencyKey: `alert-${input.key}-${String(now)}`
	});
	if (result.ok) {
		deps.logger.emit('notifications.email.sent', { reason: 'admin_alert' });
		return 'sent';
	}
	// Sin entrega no hay aviso: la alerta vuelve a quedar inactiva para que el siguiente cruce lo reintente.
	immediateTransaction(deps.db, (tx) => {
		writeRecord(tx, input.key, { active: false, lastSentAt: null }, now);
	});
	deps.logger.emit('notifications.email.failed', {
		reason: 'admin_alert',
		provider: 'resend',
		errorCode: result.errorCode
	});
	return 'sent';
}

/** La condición se normaliza: si la alerta estaba activa, se rearma sin email. */
export function clearAlert(deps: AlertDeps, key: AlertKey): void {
	const now = deps.clock.now();
	const type = alertTypeOf(key);
	const decision = immediateTransaction(deps.db, (tx) => {
		const decided = decideClear(readRecord(tx, key));
		if (decided.action === 'rearm') writeRecord(tx, key, decided.next, now);
		return decided;
	});
	if (decision.action === 'rearm') deps.logger.emit('notifications.alert.rearmed', { type });
}
