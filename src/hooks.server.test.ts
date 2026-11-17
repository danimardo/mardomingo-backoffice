// C-30 (T422): un fallo al cargar la sesión responde con `X-Request-Id` y las cabeceras de seguridad; en la API, con el
// formato de error 7.1 (`INTERNAL_ERROR`) y un único registro (contracts/api-v1.md 1.x y 7.1).
import { isRedirect, redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Emitted {
	readonly event: string;
	readonly fields: Record<string, unknown>;
}

const emitted: Emitted[] = [];
const logger = {
	child: () => logger,
	emit: (event: string, fields: Record<string, unknown>) => {
		emitted.push({ event, fields });
	}
};
const composition = {
	logger,
	config: { PUBLIC_API_URL: 'https://example.test', PUBLIC_WEB_URL: 'https://example.test' },
	accounts: {
		readSession: () => Promise.reject(new Error('fallo al leer la sesión'))
	},
	db: {},
	clock: { now: () => new Date(0) }
};

vi.mock('$app/environment', () => ({ building: false, dev: false, browser: false }));
// `sequence` de SvelteKit necesita el almacén de peticiones del servidor; aquí basta una cadena equivalente.
vi.mock('@sveltejs/kit/hooks', () => ({
	sequence:
		(...handlers: Handle[]): Handle =>
		({ event, resolve }) => {
			const run = (index: number, current: RequestEvent): Response | Promise<Response> => {
				const handler = handlers[index];
				if (handler === undefined) return resolve(current);
				return handler({ event: current, resolve: (next) => run(index + 1, next) });
			};
			return run(0, event);
		}
}));
vi.mock('$app/server', () => ({ getRequestEvent: () => undefined }));
vi.mock('$lib/server/composition.cache', () => ({
	getComposition: () => composition,
	setComposition: () => undefined
}));

const { handle } = await import('./hooks.server');

function eventOf(path: string, headers: Record<string, string>): object {
	const url = new URL(path, 'https://example.test');
	return {
		url,
		request: new Request(url, { headers }),
		route: { id: path },
		locals: {},
		cookies: { get: () => undefined },
		getClientAddress: () => '203.0.113.9',
		setHeaders: () => undefined,
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false
	};
}

// `RequestEvent` completo exige el `tracing` de SvelteKit (tipo `Span` de `@opentelemetry/api`, que no es dependencia): se
// invoca el `handle` sin aserciones y se comprueba que lo devuelto es una `Response`.
async function run(event: object): Promise<Response> {
	const resolve = () => Promise.resolve(new Response('no debe llegar', { status: 200 }));
	const result: unknown = await Reflect.apply(handle, undefined, [{ event, resolve }]);
	if (!(result instanceof Response)) throw new Error('handle no devolvió una Response');
	return result;
}

describe('[C-30] fallo de loadSession', () => {
	beforeEach(() => {
		emitted.length = 0;
	});

	it('en la API responde 500 INTERNAL_ERROR con X-Request-Id, cabeceras de seguridad y un solo registro', async () => {
		const event = eventOf('/api/v1/me', { authorization: 'Bearer abc' });
		const response = await run(event);

		expect(response.status).toBe(500);
		const body: unknown = await response.json();
		expect(body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
		expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('strict-transport-security')).not.toBeNull();
		expect(emitted.filter((item) => item.event === 'http.request.failed')).toHaveLength(1);
	});

	it('en la web responde 500 con X-Request-Id y las cabeceras de seguridad, registrado una vez', async () => {
		const event = eventOf('/panel', {});
		const response = await run(event);

		expect(response.status).toBe(500);
		expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(emitted.filter((item) => item.event === 'http.request.failed')).toHaveLength(1);
	});

	it('una redirección lanzada en un paso sigue propagándose y no se convierte en un 500', async () => {
		const readSession = composition.accounts.readSession;
		const target = new URL('/login', 'https://example.test').pathname;
		composition.accounts.readSession = async () => {
			await Promise.resolve();
			redirect(303, target);
		};
		try {
			await expect(run(eventOf('/panel', {}))).rejects.toSatisfy(isRedirect);
			expect(emitted.filter((item) => item.event === 'http.request.failed')).toHaveLength(0);
		} finally {
			composition.accounts.readSession = readSession;
		}
	});
});
