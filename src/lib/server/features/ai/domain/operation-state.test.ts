// Transiciones y cobro de las operaciones (data-model 4.4; FR-033, BE-FR-21; T160).
import { describe, expect, it } from 'vitest';
import {
	canTransition,
	chargesFor,
	OPERATION_STATUSES,
	type OperationStatus
} from './operation-state';

describe('cobro según el estado final', () => {
	it('solo se cobran las operaciones entregadas o no entregadas después de la respuesta del proveedor', () => {
		const charged = OPERATION_STATUSES.filter((status) => chargesFor(status));
		expect(charged.sort()).toEqual(['ok', 'undelivered']);
	});

	it('un fallo, una cancelación antes de la respuesta, una interrupción o un rechazo no cobran', () => {
		for (const status of [
			'provider_error',
			'cancelled',
			'interrupted',
			'rejected',
			'in_progress'
		] as const) {
			expect(chargesFor(status)).toBe(false);
		}
	});
});

describe('transiciones permitidas', () => {
	it('una operación en curso puede terminar en cualquier estado final', () => {
		for (const to of [
			'ok',
			'provider_error',
			'cancelled',
			'undelivered',
			'interrupted',
			'rejected'
		] as const) {
			expect(canTransition('in_progress', to)).toBe(true);
		}
	});

	it('un rechazo nunca pasa a otro estado (no tiene reserva ni proveedor)', () => {
		expect(canTransition('rejected', 'ok')).toBe(false);
		expect(canTransition('rejected', 'in_progress')).toBe(false);
	});

	it('una entrega no se convierte en cancelación ni en fallo', () => {
		expect(canTransition('ok', 'cancelled')).toBe(false);
		expect(canTransition('ok', 'undelivered')).toBe(false);
		expect(canTransition('undelivered', 'ok')).toBe(false);
	});

	it('nada vuelve a en curso', () => {
		const from: OperationStatus[] = [
			'ok',
			'provider_error',
			'cancelled',
			'undelivered',
			'interrupted',
			'rejected'
		];
		for (const status of from) expect(canTransition(status, 'in_progress')).toBe(false);
	});
});
