// Estado del formulario leído del resultado de su acción (`formStateOf`): cada rama del resultado.
import { describe, expect, it } from 'vitest';
import { formStateOf } from './form-state';

describe('formStateOf', () => {
	it('sin resultado de acción, todo vacío', () => {
		expect(formStateOf(undefined)).toEqual({
			errors: {},
			code: '',
			formError: '',
			success: false,
			sentTo: null
		});
		expect(formStateOf(null)).toMatchObject({ success: false, code: '' });
	});

	it('un fallo de validación trae los errores por campo y no un texto de negocio', () => {
		const state = formStateOf({ errors: { email: 'Obligatorio.' }, values: { email: '' } });

		expect(state.errors).toEqual({ email: 'Obligatorio.' });
		expect(state.code).toBe('');
		expect(state.formError).toBe('');
	});

	it('un fallo de negocio trae el código y su texto visible', () => {
		const state = formStateOf({ formError: 'INVALID_CREDENTIALS' });

		expect(state.code).toBe('INVALID_CREDENTIALS');
		expect(state.formError).toBe('Email o contraseña incorrectos.');
	});

	it('el bloqueo por intentos lleva el tiempo de espera a su texto', () => {
		const state = formStateOf({ formError: 'LOGIN_TEMPORARILY_LOCKED', retryAfterMinutes: 3 });

		expect(state.formError).toBe('Demasiados intentos fallidos. Vuelve a intentarlo en 3 minutos.');
	});

	it('un éxito trae la dirección a la que se envió', () => {
		expect(formStateOf({ success: true, sentTo: 'juan@ejemplo.es' })).toMatchObject({
			success: true,
			sentTo: 'juan@ejemplo.es',
			code: ''
		});
	});

	it('un success distinto de true no cuenta como éxito', () => {
		expect(formStateOf({ success: false })).toMatchObject({ success: false });
	});

	it('una forma que no encaja no rompe la página', () => {
		expect(formStateOf({ errors: 'no es un objeto' })).toMatchObject({
			errors: {},
			success: false,
			code: ''
		});
	});
});
