// Campo de motivo de las páginas de administración (C-55): el error junto al campo del formulario que falló y el texto escrito
// conservado. Solo el formulario cuyo `scope` coincide pinta el error y el valor.
import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { reasonFieldOf } from './reason';

describe('reasonFieldOf (C-55)', () => {
	it('sin respuesta de la acción no hay error ni valor', () => {
		expect(reasonFieldOf(null)).toEqual({ value: '', error: '' });
		expect(reasonFieldOf(undefined, 'guardar')).toEqual({ value: '', error: '' });
	});

	it('el motivo demasiado largo da su texto y conserva lo escrito', () => {
		const form = { errors: { motivo: 'reason_too_long' }, values: { motivo: 'x'.repeat(501) } };
		expect(reasonFieldOf(form)).toEqual({
			value: 'x'.repeat(501),
			error: m.validation_reason_too_long()
		});
	});

	it('el motivo vacío da «obligatorio»', () => {
		const form = { errors: { motivo: 'validation_required' }, values: { motivo: '  ' } };
		expect(reasonFieldOf(form)).toEqual({ value: '  ', error: m.validation_required() });
	});

	it('solo el formulario del mismo scope pinta el error y el valor', () => {
		const form = {
			scope: 'liberarFreno',
			errors: { motivo: 'reason_too_long' },
			values: { motivo: 'texto' }
		};
		expect(reasonFieldOf(form, 'liberarFreno')).toEqual({
			value: 'texto',
			error: m.validation_reason_too_long()
		});
		expect(reasonFieldOf(form, 'fijarAlertaMistral')).toEqual({ value: '', error: '' });
	});

	it('conserva lo escrito aunque el error sea de otro campo', () => {
		const form = { errors: { valor: 'validation_invalid' }, values: { motivo: 'Revisión' } };
		expect(reasonFieldOf(form)).toEqual({ value: 'Revisión', error: '' });
	});

	it('ignora respuestas sin la forma esperada', () => {
		expect(reasonFieldOf({ errors: 'x', values: 3 })).toEqual({ value: '', error: '' });
		expect(reasonFieldOf({ errors: { motivo: 7 }, values: { motivo: 7 } })).toEqual({
			value: '',
			error: ''
		});
	});
});
