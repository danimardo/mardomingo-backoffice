// Emisión real con pino sobre un destino en memoria (Historias.md 15.19): comprueba forma, nivel, contexto y
// que ni el mensaje de un error ni un dato sensible llegan a la línea.
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { createRootLogger, type LogThreshold } from './logger';

const SECRET = 'clave-de-prueba-no-debe-salir-9f2c';

function recordOf(line: string): Record<string, unknown> {
	return z.record(z.string(), z.unknown()).parse(JSON.parse(line));
}

function capture(level: LogThreshold = 'debug') {
	const lines: string[] = [];
	const logger = createRootLogger({
		level,
		env: 'test',
		version: '1.2.3',
		sink: {
			write(chunk: string) {
				lines.push(chunk);
			}
		}
	});
	return {
		logger,
		records: () => lines.map(recordOf),
		text: () => lines.join('')
	};
}

describe('logger raíz', () => {
	it('escribe JSON con los campos base, el código del evento y el mensaje del catálogo', () => {
		const { logger, records } = capture();

		logger.emit('app.started', { count: 0 });

		const [record] = records();
		expect(record).toMatchObject({
			schema: 1,
			service: 'mardomingo_backoffice',
			env: 'test',
			version: '1.2.3',
			level: 'info',
			event: 'app.started',
			msg: 'Aplicación iniciada',
			count: 0
		});
		expect(typeof record?.time).toBe('string');
		expect(record?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});

	it('no incluye pid ni hostname', () => {
		const { logger, records } = capture();

		logger.emit('app.started', { count: 0 });

		expect(records()[0]).not.toHaveProperty('pid');
		expect(records()[0]).not.toHaveProperty('hostname');
	});

	it('añade el contexto del hijo a todas sus líneas', () => {
		const { logger, records } = capture();

		logger
			.child({ requestId: 'req-1', method: 'GET', route: '/api/v1/health' })
			.emit(
				'http.request.completed',
				{ route: '/api/v1/health', method: 'GET', httpStatus: 200, durationMs: 4 },
				{ level: 'debug' }
			);

		expect(records()[0]).toMatchObject({ requestId: 'req-1', level: 'debug' });
	});

	it('respeta el umbral configurado', () => {
		const { logger, records } = capture('info');

		logger.emit('http.host.rejected', { reason: 'host_mismatch' });

		expect(records()).toEqual([]);
	});

	it('nunca escribe el mensaje ni los datos de un error de biblioteca', () => {
		const { logger, text } = capture();
		const error = new Error(`fallo con ${SECRET}`);

		logger.emit('app.db.migration_failed', { err: error });

		expect(text()).not.toContain(SECRET);
		expect(text()).toContain('"err":{"type":"Error"');
	});

	it('la pila de un error interno sale sin el mensaje', () => {
		const { logger, records } = capture();
		const error = new Error(`fallo con ${SECRET}`);

		logger.emit('http.request.failed', {
			route: '/api/v1/ai/chat',
			method: 'POST',
			httpStatus: 500,
			err: error
		});

		const err = z.object({ stack: z.string() }).parse(records()[0]?.err);
		expect(err.stack).toContain('    at ');
		expect(err.stack).not.toContain(SECRET);
	});
});
