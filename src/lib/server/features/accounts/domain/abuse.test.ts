import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import {
	isLoginLocked,
	minutesUntilUnlock,
	nextLoginAttempt,
	refundLoginAttempt,
	signupIpLimitReached
} from './abuse';

const MINUTE = 60_000;
const NOW = toEpochMs(1_000_000_000);
const POLICY = { maxFailures: 10, lockMinutes: 15, windowMinutes: 15 };

describe('intentos de login (BE-FR-67)', () => {
	it('el primer fallo abre una ventana nueva', () => {
		expect(nextLoginAttempt(undefined, NOW, POLICY)).toEqual({
			failures: 1,
			windowStart: NOW,
			lockedUntil: null
		});
	});

	it('un fallo dentro de la ventana suma y conserva su inicio', () => {
		const start = toEpochMs(NOW - 5 * MINUTE);
		const next = nextLoginAttempt({ failures: 3, windowStart: start }, NOW, POLICY);

		expect(next.failures).toBe(4);
		expect(next.windowStart).toBe(start);
	});

	it('un fallo justo al borde de la ventana ya cuenta como fuera de ella', () => {
		const edge = toEpochMs(NOW - POLICY.windowMinutes * MINUTE);
		const next = nextLoginAttempt({ failures: 9, windowStart: edge }, NOW, POLICY);

		expect(next).toEqual({ failures: 1, windowStart: NOW, lockedUntil: null });
	});

	it('el décimo fallo en la ventana bloquea quince minutos desde ese momento', () => {
		const start = toEpochMs(NOW - MINUTE);
		const next = nextLoginAttempt({ failures: 9, windowStart: start }, NOW, POLICY);

		expect(next.failures).toBe(10);
		expect(next.lockedUntil).toBe(toEpochMs(NOW + 15 * MINUTE));
	});

	it('el noveno fallo todavía no bloquea', () => {
		const start = toEpochMs(NOW - MINUTE);
		const next = nextLoginAttempt({ failures: 8, windowStart: start }, NOW, POLICY);

		expect(next.lockedUntil).toBeNull();
	});

	it('la comparación del bloqueo es estricta: en el instante exacto de desbloqueo ya no está bloqueado', () => {
		const until = toEpochMs(NOW + MINUTE);

		expect(isLoginLocked(until, NOW)).toBe(true);
		expect(isLoginLocked(until, until)).toBe(false);
		expect(isLoginLocked(null, NOW)).toBe(false);
		expect(isLoginLocked(undefined, NOW)).toBe(false);
	});

	it('los minutos restantes se redondean hacia arriba y nunca bajan de 1', () => {
		expect(minutesUntilUnlock(toEpochMs(NOW + 1), NOW)).toBe(1);
		expect(minutesUntilUnlock(toEpochMs(NOW + MINUTE), NOW)).toBe(1);
		expect(minutesUntilUnlock(toEpochMs(NOW + MINUTE + 1), NOW)).toBe(2);
		expect(minutesUntilUnlock(toEpochMs(NOW + 15 * MINUTE), NOW)).toBe(15);
	});
});

describe('devolución de un intento reservado que no fue un fallo (C-16)', () => {
	const start = toEpochMs(NOW - MINUTE);
	const lock = toEpochMs(NOW + 15 * MINUTE);

	it('resta el intento de la misma ventana', () => {
		const reserved = { failures: 4, windowStart: start, lockedUntil: null };

		expect(refundLoginAttempt({ ...reserved, failures: 6 }, reserved)).toEqual({
			failures: 5,
			windowStart: start,
			lockedUntil: null
		});
	});

	it('sin fallos ni bloqueo no queda nada que guardar', () => {
		const reserved = { failures: 1, windowStart: start, lockedUntil: null };

		expect(refundLoginAttempt(reserved, reserved)).toBeNull();
	});

	it('quita el bloqueo que puso la propia reserva, aunque la ventana siga llena', () => {
		const reserved = { failures: 11, windowStart: start, lockedUntil: lock };

		expect(refundLoginAttempt(reserved, reserved)).toEqual({
			failures: 10,
			windowStart: start,
			lockedUntil: null
		});
	});

	it('conserva el bloqueo que puso otra reserva', () => {
		const reserved = { failures: 9, windowStart: start, lockedUntil: null };

		expect(
			refundLoginAttempt({ failures: 10, windowStart: start, lockedUntil: lock }, reserved)
		).toEqual({ failures: 9, windowStart: start, lockedUntil: lock });
	});

	it('no devuelve nada si un acierto ya limpió el contador o empezó otra ventana', () => {
		const reserved = { failures: 3, windowStart: start, lockedUntil: null };

		expect(refundLoginAttempt(undefined, reserved)).toBeUndefined();
		expect(
			refundLoginAttempt({ failures: 1, windowStart: NOW, lockedUntil: null }, reserved)
		).toBeUndefined();
	});
});

describe('altas por IP (BE-FR-11.2)', () => {
	it('con menos altas que el límite se permite una más', () => {
		expect(signupIpLimitReached(2, 3)).toBe(false);
	});

	it('al llegar exactamente al límite se rechaza la siguiente', () => {
		expect(signupIpLimitReached(3, 3)).toBe(true);
	});
});
