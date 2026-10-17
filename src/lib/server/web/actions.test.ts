// Helpers de las acciones web (contracts/web-routes.md 1.4): la IP del cliente y la traducción de un error de negocio a
// `fail` con su código del catálogo.
import { describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from './actions';

describe('clientIpOf', () => {
	it('devuelve la IP que da la plataforma', () => {
		expect(clientIpOf(() => '203.0.113.7')).toBe('203.0.113.7');
	});

	it('si la plataforma no da IP (pruebas, sin conexión), devuelve null', () => {
		const sinDireccion = (): string => {
			throw new Error('sin dirección');
		};

		expect(clientIpOf(sinDireccion)).toBeNull();
	});
});

describe('failureOf', () => {
	it('convierte el error en un fail con su código, su estado y los valores del formulario', () => {
		const failure = failureOf(new AppError('INVALID_CREDENTIALS'), { email: 'juan@ejemplo.es' });

		expect(failure.status).toBe(401);
		expect(failure.data).toEqual({
			formError: 'INVALID_CREDENTIALS',
			values: { email: 'juan@ejemplo.es' }
		});
	});

	it('añade el tiempo de espera cuando el error lo trae', () => {
		const failure = failureOf(new AppError('LOGIN_TEMPORARILY_LOCKED', { retryAfterMinutes: 12 }));

		expect(failure.status).toBe(429);
		expect(failure.data).toMatchObject({
			formError: 'LOGIN_TEMPORARILY_LOCKED',
			retryAfterMinutes: 12
		});
	});

	it('sin tiempo de espera, no lo añade', () => {
		const failure = failureOf(new AppError('TOKEN_USED'));

		expect(failure.status).toBe(400);
		expect(failure.data).not.toHaveProperty('retryAfterMinutes');
	});

	it('sin valores, manda un objeto vacío', () => {
		const failure = failureOf(new AppError('VALIDATION_ERROR'));

		expect(failure.data).toEqual({ formError: 'VALIDATION_ERROR', values: {} });
	});
});
