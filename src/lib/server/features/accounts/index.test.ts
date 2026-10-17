// Usuario de la sesión en la forma de los guards (`sessionUserOf`): la frontera con Better Auth, que puede traer campos
// nulos o ausentes.
import { describe, expect, it } from 'vitest';
import { createFakeLogger, eventsNamed } from '../../../../../tests/builders/fake-logger';
import { reportDenial, sessionUserOf } from './index';

const ROW = { id: 'usr_1', email: 'juan@ejemplo.es', emailVerified: true };

describe('sessionUserOf', () => {
	it('traduce la sesión completa a la forma de los guards', () => {
		expect(sessionUserOf({ ...ROW, banned: false, role: 'user,admin' })).toEqual({
			...ROW,
			banned: false,
			role: 'user,admin'
		});
	});

	it('sin rol ni marca de bloqueo, es un usuario normal no bloqueado', () => {
		expect(sessionUserOf(ROW)).toEqual({ ...ROW, banned: false, role: 'user' });
	});

	it('la marca de bloqueo nula no bloquea; la verdadera, sí', () => {
		expect(sessionUserOf({ ...ROW, banned: null })).toMatchObject({ banned: false });
		expect(sessionUserOf({ ...ROW, banned: true })).toMatchObject({ banned: true });
	});

	it('una forma que no encaja no es un usuario', () => {
		expect(sessionUserOf({ id: 'usr_1' })).toBeNull();
		expect(sessionUserOf(null)).toBeNull();
	});
});

describe('reportDenial', () => {
	it('registra la denegación con su motivo y su estado, sin datos personales', () => {
		const logger = createFakeLogger();

		reportDenial(logger, { kind: 'unverified' });

		const denied = eventsNamed(logger, 'accounts.guard.denied');
		expect(denied).toHaveLength(1);
		expect(JSON.stringify(denied)).toContain('unverified');
		expect(JSON.stringify(denied)).not.toContain('juan@ejemplo.es');
	});

	it('un acceso permitido no registra nada', () => {
		const logger = createFakeLogger();

		reportDenial(logger, { kind: 'allow', user: { ...ROW, banned: false, role: 'user' } });

		expect(eventsNamed(logger, 'accounts.guard.denied')).toHaveLength(0);
	});
});
