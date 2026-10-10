// Helper de formularios de las acciones web (contracts/web-routes.md 1.4; principio XII). Convierte el
// `FormData` en un objeto (repetidos como lista, vacíos como `undefined`, casillas como booleano), lo
// valida con Zod y, si falla, devuelve `fail(400, { values, errors })` sin contraseñas ni claves.
import { fail, type ActionFailure } from '@sveltejs/kit';
import type * as z from 'zod';
import { applyZodMessages, formMessage } from '$lib/schemas/common/zod-config';

applyZodMessages();

/** Campos que nunca vuelven al formulario ni a los logs: contraseñas, tokens, claves y secretos. */
const SENSITIVE_FIELD = /password|secret|token|key/i;

export type FormScalar = string | boolean | undefined;
export type FormValue = FormScalar | readonly string[];
export type FormValues = Readonly<Record<string, FormValue>>;

export type FormFailure = {
	readonly values: FormValues;
	readonly errors: Readonly<Record<string, string>>;
};

export interface NormalizeOptions {
	/** Casillas: presentes → `true`, ausentes → `false`. */
	readonly booleans?: readonly string[];
}

export function normalizeForm(data: FormData, options: NormalizeOptions = {}): FormValues {
	const result: Record<string, FormValue> = {};
	const keys = Array.from(new Set(data.keys()));
	for (const key of keys) {
		const values = data.getAll(key).filter((value): value is string => typeof value === 'string');
		result[key] = options.booleans?.includes(key) ? true : toValue(values);
	}
	for (const key of options.booleans ?? []) {
		result[key] ??= false;
	}
	return result;
}

function toValue(values: readonly string[]): FormValue {
	const present = values.filter((value) => value !== '');
	if (values.length > 1) return present;
	return present[0];
}

export type ParsedForm<S extends z.ZodType> =
	| { readonly ok: true; readonly data: z.output<S> }
	| { readonly ok: false; readonly failure: ActionFailure<FormFailure> };

export function parseForm<S extends z.ZodType>(
	schema: S,
	data: FormData,
	options: NormalizeOptions = {}
): ParsedForm<S> {
	const normalized = normalizeForm(data, options);
	const result = schema.safeParse(normalized);
	if (result.success) return { ok: true, data: result.data };

	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const field = issue.path.map(String).join('.') || '_form';
		errors[field] ??= formMessage(issue);
	}
	return { ok: false, failure: fail(400, { values: withoutSensitive(normalized), errors }) };
}

function withoutSensitive(values: FormValues): FormValues {
	return Object.fromEntries(Object.entries(values).filter(([key]) => !SENSITIVE_FIELD.test(key)));
}
