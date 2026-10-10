// Evento de petición para los manejadores de la API en pruebas (R16). No hay `as`: el evento se construye
// completo y `Cookies` es una implementación en memoria.
import type { Cookies } from '@sveltejs/kit';
import type { ApiEvent } from '$lib/server/api/handler';
import type { Appearance } from '$lib/appearance/preferences';
import { createFakeLogger, type FakeLogger } from './fake-logger';

export interface ApiEventOptions {
	readonly method?: string;
	readonly url?: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly body?: string;
	readonly clientAddress?: string;
	readonly cookies?: Readonly<Record<string, string>>;
	readonly logger?: FakeLogger;
}

export interface TestApiEvent extends ApiEvent {
	readonly locals: ApiEvent['locals'] & { readonly log: FakeLogger };
}

export function createInMemoryCookies(initial: Readonly<Record<string, string>> = {}): Cookies {
	const jar = new Map<string, string>(Object.entries(initial));
	return {
		get: (name) => jar.get(name),
		getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
		set: (name, value) => {
			jar.set(name, value);
		},
		delete: (name) => {
			jar.delete(name);
		},
		serialize: (name, value) => `${name}=${encodeURIComponent(value)}`
	};
}

export function makeApiEvent(options: ApiEventOptions = {}): TestApiEvent {
	const logger = options.logger ?? createFakeLogger();
	const appearance: Appearance = { theme: 'system', effects: 'normal' };
	const request = new Request(options.url ?? 'http://127.0.0.1:7312/api/v1/health', {
		method: options.method ?? 'GET',
		...(options.headers === undefined ? {} : { headers: options.headers }),
		...(options.body === undefined ? {} : { body: options.body })
	});
	return {
		request,
		url: new URL(request.url),
		route: { id: null },
		cookies: createInMemoryCookies(options.cookies),
		getClientAddress: () => options.clientAddress ?? '203.0.113.7',
		locals: {
			requestId: '00000000-0000-4000-8000-000000000000',
			log: logger,
			appearance,
			app: null,
			user: null,
			session: null
		}
	};
}
