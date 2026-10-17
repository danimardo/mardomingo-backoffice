// Filtros de las listas del panel (UX-09, BE-FR-49.8; T251). Las fechas van en `dd/mm/aaaa` o ISO; la página es un entero ≥ 1
// escrito solo con dígitos (sin coerción implícita, que convertiría «2x» o «» sin avisar); el periodo solo admite 30 o 90.
import type { CivilDate } from '$lib/shared/time';
import { parseDateEs } from './date-es';

const MESSAGE = 'validation_invalid';
const WHOLE_PAGE = /^[1-9]\d*$/;

export interface PanelFilters {
	readonly desde: CivilDate | null;
	readonly hasta: CivilDate | null;
	readonly app: string | null;
	readonly pagina: number;
	readonly periodo: 30 | 90 | null;
}

export type FilterResult =
	| { readonly ok: true; readonly value: PanelFilters }
	| { readonly ok: false; readonly errors: Readonly<Record<string, string>> };

/** Lee los filtros de la query de una lista. Vacío equivale a ausente. */
export function parsePanelFilters(
	input: Readonly<Record<string, string | undefined>>
): FilterResult {
	const errors: Record<string, string> = {};
	const desde = dateOf(input.desde, 'desde', errors);
	const hasta = dateOf(input.hasta, 'hasta', errors);
	if (desde !== null && hasta !== null && desde > hasta) errors.hasta = MESSAGE;
	const pagina = pageOf(input.pagina, errors);
	const periodo = periodOf(input.periodo, errors);
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	const app = input.app === undefined || input.app === '' ? null : input.app;
	return { ok: true, value: { desde, hasta, app, pagina, periodo } };
}

function dateOf(
	text: string | undefined,
	field: string,
	errors: Record<string, string>
): CivilDate | null {
	if (text === undefined || text === '') return null;
	const date = parseDateEs(text);
	if (date === undefined) {
		errors[field] = MESSAGE;
		return null;
	}
	return date;
}

function pageOf(text: string | undefined, errors: Record<string, string>): number {
	if (text === undefined || text === '') return 1;
	if (!WHOLE_PAGE.test(text)) {
		errors.pagina = MESSAGE;
		return 1;
	}
	return Number(text);
}

function periodOf(text: string | undefined, errors: Record<string, string>): 30 | 90 | null {
	if (text === undefined || text === '') return null;
	if (text === '30') return 30;
	if (text === '90') return 90;
	errors.periodo = MESSAGE;
	return null;
}

/** `aaaa-mm-dd` → `dd/mm/aaaa`, el formato que escribe la persona en el formulario. */
function formatEs(day: string): string {
	const [year = '', month = '', date = ''] = day.split('-');
	return `${date}/${month}/${year}`;
}

/** Query de la URL con los filtros y, opcionalmente, otra página. La usan la paginación y la exportación (sin JavaScript). */
export function queryOfFilters(filters: PanelFilters, page: number | null): string {
	const params = new URLSearchParams();
	if (filters.desde !== null) params.set('desde', formatEs(filters.desde));
	if (filters.hasta !== null) params.set('hasta', formatEs(filters.hasta));
	if (filters.app !== null) params.set('app', filters.app);
	if (page !== null && page > 1) params.set('pagina', String(page));
	const query = params.toString();
	return query === '' ? '' : `?${query}`;
}
