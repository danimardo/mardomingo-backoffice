// `X-Request-Id` (principio XI; contracts/api-v1.md 1.2–1.3): el servidor genera uno nuevo en cada respuesta y el
// entrante se ignora, para que ningún cliente pueda elegir el identificador de sus registros.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('X-Request-Id', () => {
	it('toda respuesta lleva un identificador nuevo', async () => {
		const first = await send(baseUrl, '/api/v1/health');
		const second = await send(baseUrl, '/api/v1/health');

		expect(first.headers['x-request-id']).toMatch(UUID_V4);
		expect(second.headers['x-request-id']).not.toBe(first.headers['x-request-id']);
	});

	it('el identificador entrante se ignora', async () => {
		const result = await send(baseUrl, '/api/v1/health', {
			headers: { 'x-request-id': 'elegido-por-el-cliente' }
		});

		expect(result.headers['x-request-id']).toMatch(UUID_V4);
		expect(result.headers['x-request-id']).not.toBe('elegido-por-el-cliente');
	});

	it('también los errores llevan identificador', async () => {
		const result = await send(baseUrl, '/api/v1/no-existe');

		expect(result.headers['x-request-id']).toMatch(UUID_V4);
	});
});
