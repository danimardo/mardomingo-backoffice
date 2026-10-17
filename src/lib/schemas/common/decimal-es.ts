// Número decimal escrito a la española: «1.234,56». Sin `z.coerce.number()`: el texto se valida con una
// expresión regular antes de convertirlo (principio XII). Los miles con punto y la coma decimal son
// obligatorios para no confundir «1.5» (un punto) con mil quinientos.
import * as z from 'zod';
import * as m from '$lib/paraglide/messages.js';

const DECIMAL_ES = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;

export function parseDecimalEs(text: string): number | undefined {
	if (!DECIMAL_ES.test(text)) return undefined;
	const value = Number(text.replaceAll('.', '').replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

export const decimalEs = z.string().transform((text, ctx) => {
	const value = parseDecimalEs(text);
	if (value === undefined) {
		ctx.addIssue({ code: 'custom', message: m.validation_invalid() });
		return z.NEVER;
	}
	return value;
});
