// Saldo de la cuenta de OpenRouter (GET /api/v1/credits; T326) con `fetch` inyectado: créditos comprados menos uso, en micro-USD;
// cualquier respuesta que no encaje (estado, forma o red) devuelve `null` y no inventa un saldo.
import { describe, expect, it } from 'vitest';
import { createOpenRouterGateway, type FetchLike } from './openrouter';

function gatewayWith(fetch: FetchLike) {
	return createOpenRouterGateway({
		baseUrl: 'https://openrouter.test',
		apiKey: 'clave-de-prueba',
		fetch
	});
}

const signal = AbortSignal.timeout(5_000);

describe('saldo de OpenRouter (T326)', () => {
	it('devuelve los créditos comprados menos el uso, en micro-USD, con la clave en la cabecera', async () => {
		let seenAuthorization = '';
		const gateway = gatewayWith((url, init) => {
			expect(url).toBe('https://openrouter.test/api/v1/credits');
			seenAuthorization = new Headers(init.headers).get('authorization') ?? '';
			return Promise.resolve(
				new Response(JSON.stringify({ data: { total_credits: 25.5, total_usage: 4.25 } }), {
					status: 200
				})
			);
		});

		expect(await gateway.creditsBalanceMicroUsd(signal)).toBe(21_250_000);
		expect(seenAuthorization).toBe('Bearer clave-de-prueba');
	});

	it('un estado de error o una forma inesperada devuelven null', async () => {
		const bad = gatewayWith(() => Promise.resolve(new Response('{}', { status: 500 })));
		const shape = gatewayWith(() =>
			Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }))
		);

		expect(await bad.creditsBalanceMicroUsd(signal)).toBeNull();
		expect(await shape.creditsBalanceMicroUsd(signal)).toBeNull();
	});

	it('un fallo de red devuelve null', async () => {
		const down = gatewayWith(() => Promise.reject(new TypeError('fetch failed')));

		expect(await down.creditsBalanceMicroUsd(signal)).toBeNull();
	});
});
