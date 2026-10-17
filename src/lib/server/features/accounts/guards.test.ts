// Decisiones de los guards de la cuenta (contracts/web-routes.md 1.2). Son funciones puras: sin base de datos.
import { describe, expect, it } from 'vitest';
import { accessFor, denialOf, type SessionUser } from './guards';

const USER: SessionUser = {
	id: 'usr_1',
	email: 'juan@ejemplo.es',
	emailVerified: true,
	banned: false,
	role: 'user'
};
const ADMIN: SessionUser = { ...USER, role: 'user,admin' };

describe('accessFor', () => {
	it('sin sesión, cualquier requisito da anónimo', () => {
		expect(accessFor(null, 'user')).toEqual({ kind: 'anonymous' });
		expect(accessFor(null, 'verified')).toEqual({ kind: 'anonymous' });
		expect(accessFor(null, 'admin')).toEqual({ kind: 'anonymous' });
	});

	it('una cuenta bloqueada no entra, tenga la sesión que tenga', () => {
		const blocked = { ...ADMIN, banned: true };

		expect(accessFor(blocked, 'user')).toEqual({ kind: 'blocked' });
		expect(accessFor(blocked, 'admin')).toEqual({ kind: 'blocked' });
	});

	it('exigir solo sesión deja pasar a una cuenta sin verificar', () => {
		const unverified = { ...USER, emailVerified: false };

		expect(accessFor(unverified, 'user')).toEqual({ kind: 'allow', user: unverified });
	});

	it('exigir cuenta verificada rechaza la no verificada y deja pasar a la verificada', () => {
		expect(accessFor({ ...USER, emailVerified: false }, 'verified')).toEqual({
			kind: 'unverified'
		});
		expect(accessFor(USER, 'verified')).toEqual({ kind: 'allow', user: USER });
	});

	it('exigir administrador mira la lista de roles, no una subcadena', () => {
		expect(accessFor(USER, 'admin')).toEqual({ kind: 'not_admin' });
		expect(accessFor({ ...USER, role: 'user,tester' }, 'admin')).toEqual({ kind: 'not_admin' });
		expect(accessFor(ADMIN, 'admin')).toEqual({ kind: 'allow', user: ADMIN });
	});

	it('exigir administrador también pide email verificado antes que el rol', () => {
		expect(accessFor({ ...ADMIN, emailVerified: false }, 'admin')).toEqual({ kind: 'unverified' });
	});
});

describe('denialOf', () => {
	it('describe cada denegación con su motivo y su estado HTTP', () => {
		expect(denialOf({ kind: 'anonymous' })).toEqual({ reason: 'anonymous', httpStatus: 303 });
		expect(denialOf({ kind: 'blocked' })).toEqual({ reason: 'anonymous', httpStatus: 303 });
		expect(denialOf({ kind: 'unverified' })).toEqual({ reason: 'unverified', httpStatus: 303 });
		expect(denialOf({ kind: 'not_admin' })).toEqual({ reason: 'not_admin', httpStatus: 403 });
	});

	it('una petición permitida no es una denegación', () => {
		expect(denialOf({ kind: 'allow', user: USER })).toBeNull();
	});
});
