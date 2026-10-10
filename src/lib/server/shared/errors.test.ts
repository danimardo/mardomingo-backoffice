import { describe, expect, it } from 'vitest';
import { AppError, ERROR_CODES, ERROR_CODE_LIST, isErrorCode } from './errors';

describe('errores tipados', () => {
	it('asigna un estado HTTP a cada código', () => {
		for (const code of ERROR_CODE_LIST) {
			expect(ERROR_CODES[code]).toBeGreaterThanOrEqual(400);
			expect(ERROR_CODES[code]).toBeLessThanOrEqual(599);
		}
	});

	it('reconoce solo los códigos definidos en tiempo de ejecución', () => {
		expect(isErrorCode('NOT_FOUND')).toBe(true);
		expect(isErrorCode('NO_EXISTE')).toBe(false);
		expect(isErrorCode('toString')).toBe(false);
	});

	it('incluye los códigos de la API de Historias 7.2 con su estado', () => {
		expect(ERROR_CODES.VALIDATION_ERROR).toBe(400);
		expect(ERROR_CODES.UNAUTHENTICATED).toBe(401);
		expect(ERROR_CODES.INSUFFICIENT_BALANCE).toBe(402);
		expect(ERROR_CODES.ORIGIN_NOT_ALLOWED).toBe(403);
		expect(ERROR_CODES.REQUEST_IN_PROGRESS).toBe(409);
		expect(ERROR_CODES.SYNC_CONFLICT).toBe(412);
		expect(ERROR_CODES.OPERATION_TOO_EXPENSIVE).toBe(413);
		expect(ERROR_CODES.UPGRADE_REQUIRED).toBe(426);
		expect(ERROR_CODES.RATE_LIMITED).toBe(429);
		expect(ERROR_CODES.INTERNAL_ERROR).toBe(500);
		expect(ERROR_CODES.PROVIDER_TIMEOUT).toBe(504);
	});

	it('incluye los códigos propios de la web de contracts/web-routes.md', () => {
		expect(ERROR_CODES.WRONG_PASSWORD).toBe(400);
		expect(ERROR_CODES.SESSION_NOT_FOUND).toBe(404);
		expect(ERROR_CODES.SLUG_TAKEN).toBe(409);
		expect(ERROR_CODES.REGISTRATION_IP_LIMIT).toBe(429);
	});

	it('transporta el código, el estado y los detalles', () => {
		const error = new AppError('INSUFFICIENT_BALANCE', {
			requiredMicro: 5_000_000,
			availableMicro: 1_000_000
		});

		expect(error.code).toBe('INSUFFICIENT_BALANCE');
		expect(error.status).toBe(402);
		expect(error.details).toEqual({ requiredMicro: 5_000_000, availableMicro: 1_000_000 });
		expect(error.message).toBe('INSUFFICIENT_BALANCE');
	});

	it('sin detalles, el objeto de detalles está vacío', () => {
		const error = new AppError('NOT_FOUND');

		expect(error.details).toEqual({});
		expect(error.status).toBe(404);
	});
});
