// Máquina de idempotencia de las operaciones (BE-FR-81 CA1–CA2, D-12, FR-058; T159). Una clave repetida dentro de la ventana
// se trata según el estado de su última operación. Fuera de la ventana, o sin clave, la petición es independiente.
import { describe, expect, it } from 'vitest';
import { decideIdempotency, type LastOperation } from './idempotency';

const WINDOW_MS = 10 * 60 * 1000;
const NOW = 2_000_000_000;

function last(status: LastOperation['status'], ageMs = 60_000): LastOperation {
	return { status, createdAt: NOW - ageMs, operationId: 'aio_1' };
}

describe('decideIdempotency', () => {
	it('sin clave, la petición es independiente', () => {
		expect(
			decideIdempotency({ key: null, last: last('ok'), now: NOW, windowMs: WINDOW_MS })
		).toEqual({ action: 'run', replayOfUndelivered: false });
	});

	it('sin una operación previa con esa clave, se ejecuta', () => {
		expect(
			decideIdempotency({ key: 'k1', last: undefined, now: NOW, windowMs: WINDOW_MS })
		).toEqual({ action: 'run', replayOfUndelivered: false });
	});

	it('la última fila en curso devuelve REQUEST_IN_PROGRESS', () => {
		expect(
			decideIdempotency({ key: 'k1', last: last('in_progress'), now: NOW, windowMs: WINDOW_MS })
		).toEqual({ action: 'in_progress' });
	});

	it('una operación ya entregada devuelve DUPLICATE_REQUEST con su id, sin ejecutar', () => {
		expect(
			decideIdempotency({ key: 'k1', last: last('ok'), now: NOW, windowMs: WINDOW_MS })
		).toEqual({ action: 'duplicate', operationId: 'aio_1' });
	});

	it('tras undelivered se ejecuta de nuevo sin cobro (undelivered_replay)', () => {
		expect(
			decideIdempotency({ key: 'k1', last: last('undelivered'), now: NOW, windowMs: WINDOW_MS })
		).toEqual({ action: 'run', replayOfUndelivered: true });
	});

	it('tras un fallo, cancelación, interrupción o rechazo, se ejecuta con normalidad', () => {
		for (const status of ['provider_error', 'cancelled', 'interrupted', 'rejected'] as const) {
			expect(
				decideIdempotency({ key: 'k1', last: last(status), now: NOW, windowMs: WINDOW_MS })
			).toEqual({ action: 'run', replayOfUndelivered: false });
		}
	});

	it('fuera de la ventana, la clave ya no cuenta', () => {
		expect(
			decideIdempotency({
				key: 'k1',
				last: last('ok', WINDOW_MS + 1),
				now: NOW,
				windowMs: WINDOW_MS
			})
		).toEqual({ action: 'run', replayOfUndelivered: false });
	});

	it('la clave reutilizada con otro cuerpo se trata igual: la decisión no mira el cuerpo', () => {
		const first = decideIdempotency({ key: 'k1', last: last('ok'), now: NOW, windowMs: WINDOW_MS });
		const second = decideIdempotency({
			key: 'k1',
			last: last('ok'),
			now: NOW,
			windowMs: WINDOW_MS
		});
		expect(second).toEqual(first);
	});
});
