// Embudo de alta por semanas (W45, `embudo`; T320). Función pura: agrupa cada etapa por la semana ISO (lunes a domingo) de su fecha
// civil, en modo `semanal` (recuento de la semana) o `acumulado` (suma hasta esa semana). Una etapa sin ningún dato en el periodo es
// nula en todas las semanas: nunca cero, como en el resto de W45.

export const FUNNEL_MODES = Object.freeze(['semanal', 'acumulado'] as const);
export type FunnelMode = (typeof FUNNEL_MODES)[number];

export const FUNNEL_STAGES = Object.freeze([
	'descargas',
	'altas',
	'verificadas',
	'primer_login',
	'primera_operacion'
] as const);
export type FunnelStageName = (typeof FUNNEL_STAGES)[number];

export interface DatedCount {
	/** Día civil `AAAA-MM-DD`. */
	readonly date: string;
	readonly count: number;
}

export interface FunnelWeek {
	/** Lunes de la semana ISO, `AAAA-MM-DD`. */
	readonly week: string;
	readonly counts: Readonly<Record<FunnelStageName, number | null>>;
}

/** Días desde 1970-01-01 de un día civil `AAAA-MM-DD` (algoritmo de calendario gregoriano, sin zona horaria ni `Date`). */
function daysOf(date: string): number {
	const [y0 = 1970, m = 1, d = 1] = date.split('-').map(Number);
	const y = m <= 2 ? y0 - 1 : y0;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/** Día civil `AAAA-MM-DD` de un número de días desde 1970-01-01. */
function civilOf(days: number): string {
	const z = days + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
	);
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const m = mp < 10 ? mp + 3 : mp - 9;
	const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
	return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Lunes de la semana ISO de un día civil. 1970-01-01 fue jueves: con lunes = 0, el desplazamiento es (días + 3) módulo 7. */
export function mondayOf(date: string): string {
	const days = daysOf(date);
	const offset = (((days + 3) % 7) + 7) % 7;
	return civilOf(days - offset);
}

export function funnelByWeek(
	stages: Readonly<Record<FunnelStageName, readonly DatedCount[] | null>>,
	mode: FunnelMode
): FunnelWeek[] {
	const weeks = new Set<string>();
	for (const stage of FUNNEL_STAGES) {
		for (const row of stages[stage] ?? []) weeks.add(mondayOf(row.date));
	}
	const sorted = [...weeks].sort();

	const perStage = (rows: readonly DatedCount[] | null): Map<string, number> | null => {
		if (rows === null) return null;
		const sums = new Map<string, number>();
		for (const row of rows) {
			const week = mondayOf(row.date);
			sums.set(week, (sums.get(week) ?? 0) + row.count);
		}
		return sums;
	};
	const sums = {
		descargas: perStage(stages.descargas),
		altas: perStage(stages.altas),
		verificadas: perStage(stages.verificadas),
		primer_login: perStage(stages.primer_login),
		primera_operacion: perStage(stages.primera_operacion)
	} satisfies Record<FunnelStageName, Map<string, number> | null>;

	const running: Record<FunnelStageName, number> = {
		descargas: 0,
		altas: 0,
		verificadas: 0,
		primer_login: 0,
		primera_operacion: 0
	};
	return sorted.map((week) => {
		const value = (stage: FunnelStageName): number | null => {
			const byWeek = sums[stage];
			if (byWeek === null) return null;
			const weekly = byWeek.get(week) ?? 0;
			if (mode === 'semanal') return weekly;
			running[stage] += weekly;
			return running[stage];
		};
		return {
			week,
			counts: {
				descargas: value('descargas'),
				altas: value('altas'),
				verificadas: value('verificadas'),
				primer_login: value('primer_login'),
				primera_operacion: value('primera_operacion')
			}
		};
	});
}
