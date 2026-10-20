// Cuentas inactivas (BE-FR-86; T295, T296). Una cuenta verificada sin ninguna compra real y sin actividad durante
// `inactive_account_years` años recibe un aviso; si no hay actividad en los `inactive_account_notice_days` días siguientes, se
// borra. Cualquier actividad durante el aviso lo cancela, y una cuenta con compra real nunca se cierra sola (CA1): no hay
// manera de que la plataforma se quede con el dinero de alguien.
import { civilDateOf, DAY_MS, madridMidnight } from '$lib/shared/dates';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { addMonths } from './retention';

export interface InactivityAccount {
	/** Última actividad (o el alta si nunca hubo). */
	readonly referenceAt: number;
	/** Cuándo se envió el aviso, si se envió. */
	readonly warnedAt: number | null;
	readonly hasRealPurchase: boolean;
}

export interface InactivityConfig {
	readonly years: number;
	readonly noticeDays: number;
}

export type InactivityDecision = 'none' | 'warn' | 'delete' | 'cancel';

export function decideInactivity(
	account: InactivityAccount,
	now: EpochMs,
	config: InactivityConfig
): InactivityDecision {
	if (account.hasRealPurchase) return 'none';
	if (account.warnedAt !== null) {
		// Actividad posterior al aviso: el borrado queda cancelado (CA2).
		if (account.referenceAt > account.warnedAt) return 'cancel';
		return now >= account.warnedAt + config.noticeDays * DAY_MS ? 'delete' : 'none';
	}
	const dueFrom = madridMidnight(
		addMonths(civilDateOf(toEpochMs(account.referenceAt)), config.years * 12)
	);
	return now >= dueFrom ? 'warn' : 'none';
}
