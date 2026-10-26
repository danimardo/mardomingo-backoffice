// Plazos de retención de datos personales (BE-FR-83; data-model §6; T292, T293). Funciones puras: reciben el instante actual y
// devuelven los cortes; cada dueña de datos aplica el suyo. Los plazos de 24 meses se cuentan en meses de calendario desde la
// medianoche de Madrid, para que un cambio de día o de hora no mueva el corte.
import { civilDateOf, DAY_MS, madridMidnight } from '$lib/shared/dates';
import {
	daysInMonth,
	toCivilDate,
	toEpochMs,
	type CivilDate,
	type EpochMs
} from '$lib/shared/time';

const SESSION_DAYS = 30;
const OPERATION_MONTHS = 24;
const ALERT_DAYS = 30;

/** Suma (o resta) meses de calendario. Si el día no existe en el mes de destino, queda en el último día de ese mes. */
export function addMonths(day: CivilDate, months: number): CivilDate {
	const year = Number(day.slice(0, 4));
	const month = Number(day.slice(5, 7));
	const dayOfMonth = Number(day.slice(8, 10));
	const index = year * 12 + (month - 1) + months;
	const targetYear = Math.floor(index / 12);
	const targetMonth = (index % 12) + 1;
	const targetDay = Math.min(dayOfMonth, daysInMonth(targetYear, targetMonth));
	const pad = (value: number, width: number): string => String(value).padStart(width, '0');
	return toCivilDate(`${pad(targetYear, 4)}-${pad(targetMonth, 2)}-${pad(targetDay, 2)}`);
}

export interface RetentionCutoffs {
	/** Sesiones cuya caducidad es anterior: 30 días después de caducar. */
	readonly sessionsExpiredBefore: EpochMs;
	/** `ai_operations` anteriores se anonimizan: 24 meses. */
	readonly operationsBefore: EpochMs;
	/** Reservas liberadas anteriores se borran: 24 meses. */
	readonly holdsReleasedBefore: EpochMs;
	/** Contadores de login y de límites por IP con ventana anterior: más de 24 horas. */
	readonly attemptsBefore: EpochMs;
	/** Tokens de verificación que caducaron antes. */
	readonly verificationsExpiredBefore: EpochMs;
	/** Claves de alerta con usuario o fecha sin cambios desde antes: 30 días. */
	readonly alertsBefore: EpochMs;
}

export function retentionCutoffs(now: EpochMs): RetentionCutoffs {
	const monthsAgo = madridMidnight(addMonths(civilDateOf(now), -OPERATION_MONTHS));
	return {
		sessionsExpiredBefore: toEpochMs(now - SESSION_DAYS * DAY_MS),
		operationsBefore: monthsAgo,
		holdsReleasedBefore: monthsAgo,
		attemptsBefore: toEpochMs(now - DAY_MS),
		verificationsExpiredBefore: now,
		alertsBefore: toEpochMs(now - ALERT_DAYS * DAY_MS)
	};
}
