// Textos de los errores de la cuenta por código (Paraglide, es). Cada código tiene su texto y los desconocidos caen en el
// genérico.
import { describe, expect, it } from 'vitest';
import { formErrorText } from './messages';

describe('formErrorText', () => {
	it('da el texto de los errores del registro', () => {
		expect(formErrorText('CAPTCHA_INVALID')).toBe(
			'No hemos podido comprobar que eres una persona. Inténtalo de nuevo.'
		);
		expect(formErrorText('DISPOSABLE_DOMAIN')).toBe(
			'Ese dominio de email no admite registros. Usa otra dirección.'
		);
		expect(formErrorText('REGISTRATION_IP_LIMIT')).toBe(
			'Se han hecho demasiados registros desde tu conexión. Inténtalo más tarde.'
		);
		expect(formErrorText('LEGAL_VERSION_CHANGED')).toBe(
			'Los documentos legales han cambiado. Revísalos y vuelve a aceptarlos.'
		);
	});

	it('da el texto de los errores del login', () => {
		expect(formErrorText('INVALID_CREDENTIALS')).toBe('Email o contraseña incorrectos.');
		expect(formErrorText('EMAIL_NOT_VERIFIED')).toBe(
			'Tu email aún no está verificado. Revisa tu bandeja de entrada.'
		);
		expect(formErrorText('ACCOUNT_BLOCKED')).toBe(
			'Tu cuenta está bloqueada. Escribe a soporte si crees que es un error.'
		);
	});

	it('la contraseña errónea del borrado de cuenta tiene su texto', () => {
		expect(formErrorText('WRONG_PASSWORD')).toBe('La contraseña no es correcta.');
	});

	it('el límite de peticiones tiene su propio texto y no cae en el genérico', () => {
		expect(formErrorText('RATE_LIMITED')).toBe(
			'Has hecho demasiadas peticiones. Espera un momento.'
		);
	});

	it('da el texto de los enlaces de verificación', () => {
		expect(formErrorText('TOKEN_EXPIRED')).toBe('Este enlace ha caducado. Pide uno nuevo.');
		expect(formErrorText('TOKEN_USED')).toBe(
			'Este enlace ya se ha usado. Si ya confirmaste tu email, inicia sesión.'
		);
		expect(formErrorText('TOKEN_INVALID')).toBe('Este enlace no es válido. Pide uno nuevo.');
	});

	it('la sesión caducada y la falta de sesión dan el mismo aviso', () => {
		const aviso = 'Tu sesión ha caducado. Inicia sesión de nuevo.';

		expect(formErrorText('SESSION_EXPIRED')).toBe(aviso);
		expect(formErrorText('UNAUTHENTICATED')).toBe(aviso);
	});

	it('la validación da el texto de campo revisable', () => {
		expect(formErrorText('VALIDATION_ERROR')).toBe('Revisa este campo.');
	});

	it('el bloqueo por intentos muestra los minutos que faltan', () => {
		expect(formErrorText('LOGIN_TEMPORARILY_LOCKED', 7)).toBe(
			'Demasiados intentos fallidos. Vuelve a intentarlo en 7 minutos.'
		);
	});

	it('sin minutos, el bloqueo usa 15 como margen', () => {
		expect(formErrorText('LOGIN_TEMPORARILY_LOCKED')).toBe(
			'Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.'
		);
	});

	it('un código desconocido da el texto genérico de error', () => {
		expect(formErrorText('CODIGO_INVENTADO')).toBe(
			'Algo no ha funcionado. Inténtalo de nuevo más tarde.'
		);
	});
});
