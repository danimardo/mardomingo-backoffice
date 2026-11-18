import { describe, expect, it } from 'vitest';
import { readTextCapped } from './client-errors.body';

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
	new Request('http://localhost/client-errors', { method: 'POST', body, headers });

describe('[C-38] readTextCapped', () => {
	it('lee un cuerpo dentro del tope', async () => {
		expect(await readTextCapped(post('{"a":1}'), 100)).toBe('{"a":1}');
	});

	it('rechaza por content-length sin leer el cuerpo', async () => {
		let pulled = false;
		const stream = new ReadableStream(
			{
				pull() {
					pulled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const request = { headers: new Headers({ 'content-length': '5000' }), body: stream };

		expect(await readTextCapped(request, 4096)).toBeNull();
		expect(pulled).toBe(false);
	});

	it('corta la lectura al pasar del tope aunque la cabecera no lo diga', async () => {
		expect(await readTextCapped(post('x'.repeat(5000)), 4096)).toBeNull();
	});
});
