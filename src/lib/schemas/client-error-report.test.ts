import { describe, expect, it } from 'vitest';
import { clientErrorReportSchema } from './client-error-report';

const valid = {
	name: 'TypeError',
	fingerprint: 'a1b2c3d4',
	frames: ['at render (app.js:1:2)'],
	version: '1.0.0',
	count: 1
};

describe('clientErrorReportSchema', () => {
	it('acepta un informe completo', () => {
		expect(clientErrorReportSchema.safeParse({ ...valid, routeId: '/panel' }).success).toBe(true);
	});

	it('rechaza claves desconocidas, como un mensaje del error', () => {
		expect(clientErrorReportSchema.safeParse({ ...valid, message: 'texto' }).success).toBe(false);
	});

	it('rechaza una huella que no tiene el formato', () => {
		expect(clientErrorReportSchema.safeParse({ ...valid, fingerprint: 'XYZ' }).success).toBe(false);
	});

	it('rechaza un recuento que no es entero', () => {
		expect(clientErrorReportSchema.safeParse({ ...valid, count: 1.5 }).success).toBe(false);
	});
});
