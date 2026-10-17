// Fecha de calendario escrita como «dd/mm/aaaa» o en ISO «aaaa-mm-dd»; sale como `CivilDate` validada
// (principio VI: fechas de calendario sin hora ni zona).
import * as z from 'zod';
import * as m from '$lib/paraglide/messages.js';
import { InvalidTimeError, toCivilDate, type CivilDate } from '$lib/shared/time';

const DATE_ES = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function parseDateEs(text: string): CivilDate | undefined {
	const spanish = DATE_ES.exec(text);
	const iso = spanish === null ? text : spanishToIso(spanish);
	try {
		return toCivilDate(iso);
	} catch (error) {
		if (error instanceof InvalidTimeError) return undefined;
		throw error;
	}
}

/** `dd/mm/aaaa` → `aaaa-mm-dd`. */
function spanishToIso([, day = '', month = '', year = '']: RegExpExecArray): string {
	return `${year}-${month}-${day}`;
}

export const dateEs = z.string().transform((text, ctx) => {
	const date = parseDateEs(text);
	if (date === undefined) {
		ctx.addIssue({ code: 'custom', message: m.validation_invalid() });
		return z.NEVER;
	}
	return date;
});
