// Programación de `holds-cleanup` (T332): está registrada en el horario, se pone al día al arrancar y llama al servicio de
// créditos una vez por ejecución, devolviendo lo que el servicio libera.
import { describe, expect, it } from 'vitest';
import { SCHEDULE } from './schedule';
import { runHoldsCleanup } from './holds-cleanup';

describe('tarea holds-cleanup (T332)', () => {
	it('está programada a diario tras la caducidad de saldos y se pone al día al arrancar', () => {
		const entry = SCHEDULE.find((task) => task.name === 'holds-cleanup');

		expect(entry).toBeDefined();
		expect(entry?.pattern).toBe('40 4 * * *');
		expect(entry?.catchUpOnStart).toBe(true);
	});

	it('llama al servicio de créditos una vez y devuelve las reservas liberadas', () => {
		let calls = 0;
		const credits = {
			expireHolds: () => {
				calls += 1;
				return 3;
			}
		};

		expect(runHoldsCleanup(credits)).toBe(3);
		expect(calls).toBe(1);
	});
});
