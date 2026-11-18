// Reglas de antiabuso de cuentas (BE-FR-67, BE-FR-11.2; T095). Funciones puras: sin I/O, sin reloj ni `node:*`. El
// repositorio lee y escribe `login_attempts`; el servicio decide con estas funciones. Los tiempos llegan en ms epoch.

import { toEpochMs, type EpochMs } from '$lib/shared/time';

const MINUTE_MS = 60_000;

export interface LoginAttemptWindow {
	readonly failures: number;
	readonly windowStart: EpochMs;
}

export interface LoginAttemptResult {
	readonly failures: number;
	readonly windowStart: EpochMs;
	readonly lockedUntil: EpochMs | null;
}

/**
 * Siguiente estado tras un fallo de login. La ventana dura `windowMinutes` desde el primer fallo; si el fallo cae fuera
 * de ella, empieza una ventana nueva. Al llegar a `maxFailures` se bloquea `lockMinutes` desde `now`.
 */
export function nextLoginAttempt(
	current: LoginAttemptWindow | undefined,
	now: EpochMs,
	options: {
		readonly maxFailures: number;
		readonly lockMinutes: number;
		readonly windowMinutes: number;
	}
): LoginAttemptResult {
	const inWindow =
		current !== undefined && current.windowStart > now - options.windowMinutes * MINUTE_MS;
	const failures = current !== undefined && inWindow ? current.failures + 1 : 1;
	const windowStart = current !== undefined && inWindow ? current.windowStart : now;
	const lockedUntil =
		failures >= options.maxFailures ? toEpochMs(now + options.lockMinutes * MINUTE_MS) : null;
	return { failures, windowStart, lockedUntil };
}

/**
 * Estado tras devolver un intento reservado que no resultó ser un fallo (C-16): la contraseña era correcta, pero la cuenta no
 * está verificada o está bloqueada. Solo se resta si la ventana sigue siendo la de la reserva, y el bloqueo solo se quita si lo
 * puso esa reserva (mientras dura, ninguna otra reserva puede escribirlo). `undefined`: no hay nada que devolver (un acierto ya
 * limpió el contador o empezó otra ventana); `null`: no queda nada que guardar.
 */
export function refundLoginAttempt(
	current: LoginAttemptResult | undefined,
	reserved: LoginAttemptResult
): LoginAttemptResult | null | undefined {
	if (current === undefined || current.windowStart !== reserved.windowStart) return undefined;
	const ownLock = reserved.lockedUntil !== null && current.lockedUntil === reserved.lockedUntil;
	const failures = Math.max(0, current.failures - 1);
	const lockedUntil = ownLock ? null : current.lockedUntil;
	if (failures === 0 && lockedUntil === null) return null;
	return { failures, windowStart: current.windowStart, lockedUntil };
}

/** Un bloqueo vigente impide el login aunque la contraseña sea correcta. */
export function isLoginLocked(
	lockedUntil: EpochMs | null | undefined,
	now: EpochMs
): lockedUntil is EpochMs {
	return lockedUntil !== null && lockedUntil !== undefined && lockedUntil > now;
}

/** Minutos restantes de un bloqueo, redondeados hacia arriba y nunca menos de 1 (para el mensaje al usuario). */
export function minutesUntilUnlock(lockedUntil: EpochMs, now: EpochMs): number {
	return Math.max(1, Math.ceil((lockedUntil - now) / MINUTE_MS));
}

/** Altas desde una misma IP en 24 h: a partir del límite se rechaza la nueva (BE-FR-11.2). */
export function signupIpLimitReached(signupsInDay: number, limit: number): boolean {
	return signupsInDay >= limit;
}
