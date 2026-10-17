import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { normalizeForm, parseForm } from './index';

function formOf(entries: Readonly<Record<string, string | readonly string[]>>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		const items: readonly string[] = typeof value === 'string' ? [value] : value;
		for (const item of items) {
			data.append(key, item);
		}
	}
	return data;
}

describe('normalizeForm', () => {
	it('un campo vacío llega como undefined y uno repetido como lista', () => {
		const values = normalizeForm(formOf({ nombre: '', etiqueta: ['a', 'b', ''] }));

		expect(values.nombre).toBeUndefined();
		expect(values.etiqueta).toEqual(['a', 'b']);
	});

	it('las casillas son booleanos: presentes, verdadero; ausentes, falso', () => {
		const values = normalizeForm(formOf({ acepto: 'on' }), { booleans: ['acepto', 'recordar'] });

		expect(values.acepto).toBe(true);
		expect(values.recordar).toBe(false);
	});
});

describe('parseForm', () => {
	const schema = z.strictObject({
		email: z.email(),
		nombre: z.string().min(1)
	});

	it('devuelve los datos validados cuando el formulario es correcto', () => {
		const result = parseForm(schema, formOf({ email: 'ana@example.com', nombre: 'Ana' }));

		expect(result).toEqual({ ok: true, data: { email: 'ana@example.com', nombre: 'Ana' } });
	});

	it('en fallo devuelve 400 con un error por campo en español y sin valores sensibles', () => {
		const result = parseForm(
			schema,
			formOf({ email: 'no-es-email', nombre: '', password: 'secreto-123' })
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.failure.status).toBe(400);
		expect(result.failure.data).toEqual({
			values: { email: 'no-es-email', nombre: undefined },
			errors: {
				email: 'Revisa este campo.',
				nombre: 'Este campo es obligatorio.',
				_form: 'Revisa este campo.'
			}
		});
		expect(JSON.stringify(result.failure.data)).not.toContain('secreto-123');
	});

	it('un campo obligatorio ausente muestra el mensaje de obligatorio', () => {
		const result = parseForm(schema, formOf({ email: 'ana@example.com' }));

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.failure.data).toMatchObject({
			errors: { nombre: 'Este campo es obligatorio.' }
		});
	});

	it('una clave que no está en el esquema se rechaza sin devolver su valor', () => {
		const result = parseForm(
			schema,
			formOf({ email: 'ana@example.com', nombre: 'Ana', extra: 'x' })
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.failure.data).toMatchObject({ errors: { _form: 'Revisa este campo.' } });
	});
});
